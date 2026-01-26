import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

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
  private static readonly SECRET = process.env.CMS_JWT_SECRET!;
  private static readonly ISSUER = 'businesstuner.io';

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

    if (!connection || connection.projectId !== projectId) {
      throw new Error('Invalid connection for project');
    }

    if (connection.status === 'DISABLED') {
      throw new Error('CMS connection is disabled');
    }

    const payload: Omit<CMSSessionPayload, 'iat' | 'exp'> = {
      userId,
      userEmail: user.email,
      projectId,
      connectionId,
      organizationId: connection.project.organizationId!,
      permissions: 'full'
    };

    return jwt.sign(payload, this.SECRET, {
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
      const payload = jwt.verify(token, this.SECRET, {
        issuer: this.ISSUER
      }) as CMSSessionPayload;

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

      // Verifica che la connessione CMS sia ancora attiva
      const connection = await prisma.cMSConnection.findUnique({
        where: { id: payload.connectionId }
      });

      if (!connection || connection.status === 'DISABLED') {
        return { valid: false, error: 'CMS connection disabled' };
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
    // Check direct project access
    const directAccess = await prisma.projectAccess.findUnique({
      where: {
        userId_projectId: { userId, projectId }
      }
    });
    if (directAccess) return true;

    // Check if user is project owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, organizationId: true }
    });
    if (project?.ownerId === userId) return true;

    // Check organization membership
    if (project?.organizationId) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: { userId, organizationId: project.organizationId }
        }
      });
      if (membership) return true;
    }

    return false;
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
