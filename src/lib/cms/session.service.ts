import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/domain/workspace';
import { decrypt } from '@/lib/cms/encryption';

interface CMSSessionPayload {
  userId: string;
  userEmail: string;
  projectId: string;
  connectionId: string;
  organizationId: string;
  permissions: 'full';
  iat: number;
  exp: number;
}

export class CMSSessionService {
  private static readonly ISSUER = 'businesstuner.io';

  private static decodeConnectionApiKey(storedApiKey: string): string {
    try {
      return decrypt(storedApiKey);
    } catch {
      // Backward compatibility for legacy/plain-text keys.
      return storedApiKey;
    }
  }

  private static getJwtSecretCandidates(connection: {
    apiKey: string;
    webhookSecret?: string | null;
  }): string[] {
    const candidates: string[] = [];

    const explicitSecret = process.env.CMS_JWT_SECRET?.trim();
    if (explicitSecret) candidates.push(explicitSecret);

    const webhookSecret = connection.webhookSecret
      ? this.decodeConnectionApiKey(connection.webhookSecret).trim()
      : '';
    if (webhookSecret) candidates.push(webhookSecret);

    const connectionApiKey = this.decodeConnectionApiKey(connection.apiKey).trim();
    if (connectionApiKey) candidates.push(connectionApiKey);

    return Array.from(new Set(candidates));
  }

  /**
   * Genera un token JWT per l'accesso al CMS.
   * Il token è valido finché la sessione BT dell'utente è attiva.
   * Usiamo una durata di 24 ore con refresh automatico.
   * Disponibile solo per piano BUSINESS o superiore.
   */
  static async generateToken(
    userId: string,
    projectId: string,
    connectionId: string
  ): Promise<string> {
    // Verifica che l'utente abbia accesso al progetto
    const hasAccess = await this.verifyUserProjectAccess(userId, projectId);
    if (!hasAccess) {
      throw new Error('User does not have access to this project');
    }

    // Verifica piano BUSINESS
    const hasPlan = await this.verifyBusinessPlan(userId, projectId);
    if (!hasPlan) {
      throw new Error('CMS Voler.ai requires BUSINESS plan');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const connection = await prisma.cMSConnection.findUnique({
      where: { id: connectionId },
      include: { project: true }
    });

    if (!connection || connection.projectId !== projectId || !connection.project) {
      throw new Error('Invalid connection for project');
    }

    if (connection.status === 'DISABLED') {
      throw new Error('CMS connection is disabled');
    }

    const jwtSecrets = this.getJwtSecretCandidates(connection);
    if (jwtSecrets.length === 0) {
      throw new Error('CMS JWT secret is not configured');
    }

    const payload: Omit<CMSSessionPayload, 'iat' | 'exp'> = {
      userId,
      userEmail: user.email,
      projectId,
      connectionId,
      organizationId: connection.project.organizationId!,
      permissions: 'full'
    };

    return jwt.sign(payload, jwtSecrets[0], {
      expiresIn: '24h',
      issuer: this.ISSUER,
      audience: connection.cmsApiUrl
    });
  }

  /**
   * Valida un token JWT (chiamato dal CMS via API).
   * Ritorna i dati dell'utente se valido.
   */
  static async validateToken(token: string, expectedConnectionId: string): Promise<{
    valid: boolean;
    payload?: CMSSessionPayload;
    error?: string;
  }> {
    try {
      const connection = await prisma.cMSConnection.findUnique({
        where: { id: expectedConnectionId },
        select: {
          id: true,
          status: true,
          apiKey: true,
          webhookSecret: true
        }
      });

      if (!connection || connection.status === 'DISABLED') {
        return { valid: false, error: 'CMS connection disabled' };
      }

      const jwtSecrets = this.getJwtSecretCandidates(connection);
      if (jwtSecrets.length === 0) {
        return { valid: false, error: 'CMS JWT secret not configured' };
      }

      let payload: CMSSessionPayload | null = null;
      for (const secret of jwtSecrets) {
        try {
          payload = jwt.verify(token, secret, {
            issuer: this.ISSUER
          }) as CMSSessionPayload;
          break;
        } catch {
          // Try next candidate (compat: env/webhook/api).
        }
      }

      if (!payload) {
        return { valid: false, error: 'Invalid token' };
      }

      // Verifica che il token sia per la connessione corretta
      if (payload.connectionId !== expectedConnectionId) {
        return { valid: false, error: 'Token not valid for this CMS' };
      }

      // Verifica che l'utente abbia ancora accesso (potrebbe essere stato revocato)
      const hasAccess = await this.verifyUserProjectAccess(
        payload.userId,
        payload.projectId
      );

      if (!hasAccess) {
        return { valid: false, error: 'User access revoked' };
      }

      return { valid: true, payload };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, error: 'Token expired' };
      }
      return { valid: false, error: 'Invalid token' };
    }
  }

  /**
   * Verifica se un utente ha accesso a un progetto.
   */
  private static async verifyUserProjectAccess(
    userId: string,
    projectId: string
  ): Promise<boolean> {
    try {
      await assertProjectAccess(userId, projectId, 'MEMBER');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verifica se l'utente ha un piano BUSINESS o superiore.
   * CMS Voler.ai è disponibile solo per piano BUSINESS/ENTERPRISE/ADMIN.
   */
  private static async verifyBusinessPlan(
    userId: string,
    projectId: string
  ): Promise<boolean> {
    // Check user's personal plan first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, role: true }
    });

    // Admin users always have access
    if (user?.role === 'ADMIN' || user?.plan === 'ADMIN') {
      return true;
    }

    // Check user plan
    if (user?.plan === 'BUSINESS') {
      return true;
    }

    // Check organization subscription
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          include: { subscription: true }
        }
      }
    });

    const tier = project?.organization?.subscription?.tier;
    return tier === 'BUSINESS' || tier === 'ENTERPRISE' || tier === 'ADMIN';
  }

  /**
   * Genera URL per aprire la dashboard CMS con autenticazione.
   */
  static async generateCMSDashboardUrl(
    userId: string,
    projectId: string,
    connectionId: string
  ): Promise<string> {
    const connection = await prisma.cMSConnection.findUnique({
      where: { id: connectionId }
    });

    if (!connection?.cmsDashboardUrl) {
      throw new Error('CMS dashboard URL not configured');
    }

    const token = await this.generateToken(userId, projectId, connectionId);

    // Passa il token come query parameter (il CMS lo salverà in sessione)
    const url = new URL(connection.cmsDashboardUrl);
    url.searchParams.set('bt_token', token);
    url.searchParams.set('bt_connection', connectionId);

    return url.toString();
  }
}
