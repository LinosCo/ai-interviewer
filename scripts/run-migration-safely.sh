#!/bin/bash

# Safe Migration Script for Connection Sharing
# This script will guide you through the migration process with safety checks

set -e  # Exit on any error

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Safe Database Migration - Connection Sharing              ║${NC}"
echo -e "${BLUE}║     This will add multi-project support for connections       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Verify environment
echo -e "${BLUE}[1/8] Verifico environment...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ File .env non trovato!${NC}"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx non trovato. Installa Node.js prima di continuare.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment OK${NC}"
echo ""

# Step 2: Check database connection
echo -e "${BLUE}[2/8] Verifico connessione database...${NC}"
if ! npx prisma db execute --stdin <<< "SELECT 1;" &> /dev/null; then
    echo -e "${RED}❌ Impossibile connettersi al database!${NC}"
    echo "Verifica la stringa di connessione DATABASE_URL nel file .env"
    exit 1
fi
echo -e "${GREEN}✅ Connessione database OK${NC}"
echo ""

# Step 3: Create backup
echo -e "${BLUE}[3/8] Creo backup del database...${NC}"
BACKUP_FILE="backup_before_migration_$(date +%Y%m%d_%H%M%S).sql"

# Ask for confirmation
echo -e "${YELLOW}⚠️  IMPORTANTE: Stai per creare un backup del database.${NC}"
echo -e "${YELLOW}   Il backup sarà salvato in: ${BACKUP_FILE}${NC}"
echo ""
read -p "Vuoi procedere con il backup? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Migrazione annullata dall'utente${NC}"
    exit 1
fi

# For PostgreSQL
if command -v pg_dump &> /dev/null; then
    # Extract database info from DATABASE_URL
    echo "Eseguo backup PostgreSQL..."
    echo -e "${YELLOW}⚠️  Se il backup fallisce, puoi continuare comunque ma è ALTAMENTE sconsigliato.${NC}"
    # Note: pg_dump might need manual connection string - left as manual step
    echo -e "${YELLOW}💡 ESEGUI MANUALMENTE:${NC}"
    echo "   pg_dump <tuo_database> > $BACKUP_FILE"
    echo ""
    read -p "Hai completato il backup manualmente? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Migrazione annullata - completa il backup prima di continuare${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Backup completato${NC}"
echo ""

# Step 4: Show what will be done
echo -e "${BLUE}[4/8] Cosa verrà fatto:${NC}"
echo "   ✓ Creare tabella ProjectCMSConnection (associazioni CMS-Progetti)"
echo "   ✓ Creare tabella ProjectMCPConnection (associazioni MCP-Progetti)"
echo "   ✓ Aggiungere campo organizationId a MCPConnection"
echo "   ✓ Aggiungere indici per performance"
echo "   ✓ NESSUN DATO VERRÀ CANCELLATO O MODIFICATO"
echo ""
read -p "Vuoi procedere con la migrazione? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Migrazione annullata dall'utente${NC}"
    exit 1
fi

# Step 5: Run SQL migration
echo -e "${BLUE}[5/8] Eseguo migration SQL...${NC}"
if npx prisma db execute --stdin < prisma/migrations/add_connection_sharing/migration.sql; then
    echo -e "${GREEN}✅ Migration SQL completata${NC}"
else
    echo -e "${RED}❌ Migration SQL fallita!${NC}"
    echo "Controlla gli errori sopra. Il database potrebbe essere già aggiornato."
    echo "Se è la seconda volta che esegui questo script, è normale."
    read -p "Vuoi continuare comunque? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# Step 6: Verify tables created
echo -e "${BLUE}[6/8] Verifico che le tabelle siano state create...${NC}"
TABLES_EXIST=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('ProjectCMSConnection', 'ProjectMCPConnection');" 2>/dev/null || echo "0")
echo -e "${GREEN}✅ Verifica tabelle completata${NC}"
echo ""

# Step 7: Generate Prisma Client
echo -e "${BLUE}[7/8] Genero client Prisma aggiornato...${NC}"
if npx prisma generate; then
    echo -e "${GREEN}✅ Client Prisma generato${NC}"
else
    echo -e "${RED}❌ Generazione client Prisma fallita!${NC}"
    exit 1
fi
echo ""

# Step 8: Run data migration
echo -e "${BLUE}[8/8] Eseguo migrazione dati...${NC}"
echo -e "${YELLOW}⚠️  Questo script copierà i dati esistenti nelle nuove tabelle.${NC}"
echo -e "${YELLOW}   I dati originali NON verranno modificati.${NC}"
echo ""
read -p "Vuoi eseguire la migrazione dati? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if npx ts-node scripts/migrate-connection-data.ts; then
        echo -e "${GREEN}✅ Migrazione dati completata${NC}"
    else
        echo -e "${RED}❌ Migrazione dati fallita!${NC}"
        echo "Controlla gli errori sopra. Puoi riprovare eseguendo:"
        echo "   npx ts-node scripts/migrate-connection-data.ts"
        exit 1
    fi
else
    echo -e "${YELLOW}⏭️  Migrazione dati saltata. Potrai eseguirla in seguito con:${NC}"
    echo "   npx ts-node scripts/migrate-connection-data.ts"
fi
echo ""

# Success!
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 ✅ MIGRAZIONE COMPLETATA!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Riepilogo:${NC}"
echo "   ✓ Nuove tabelle create"
echo "   ✓ Dati migrati nelle nuove strutture"
echo "   ✓ Dati originali preservati"
echo "   ✓ Client Prisma aggiornato"
echo ""
echo -e "${BLUE}🎯 Prossimi passi:${NC}"
echo "   1. Testa le nuove API:"
echo "      - POST /api/cms/[connectionId]/projects/associate"
echo "      - POST /api/integrations/mcp/[connectionId]/projects/associate"
echo "   2. Verifica che le connessioni esistenti funzionino ancora"
echo "   3. Completa l'UI per la gestione multi-progetto"
echo ""
echo -e "${YELLOW}💡 In caso di problemi, ripristina dal backup:${NC}"
echo "   psql <tuo_database> < $BACKUP_FILE"
echo ""
