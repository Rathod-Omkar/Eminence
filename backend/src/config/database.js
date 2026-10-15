const process = require('node:process');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

const initialNodeEnv = process.env.NODE_ENV;
// Load local environment files without overriding explicit process variables.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (initialNodeEnv === 'test') {
  process.env.NODE_ENV = 'test';
}

const dbUrl = process.env.DATABASE_URL;
const useSqlite = process.env.NODE_ENV === 'test' || process.env.USE_SQLITE === 'true' || process.env.DB_DIALECT === 'sqlite' || !dbUrl || dbUrl.startsWith('sqlite:');
let sequelize;

if (!useSqlite && dbUrl) {
  // Strip channel_binding if present since node-postgres (pg) does not support SCRAM channel binding
  const sanitizedUrl = dbUrl.replace(/([?&])channel_binding=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
  const isLocalhost = sanitizedUrl.includes('localhost') || sanitizedUrl.includes('127.0.0.1');

  const sequelizeOptions = {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    pool: {
      max: 35,
      min: 5,
      acquire: 60000,
      idle: 10000
    },
    retry: {
      match: [
        /ConnectionError/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /ECONNRESET/
      ],
      max: 3
    }
  };

  // If connecting to Neon or remote Postgres, use @neondatabase/serverless with WebSockets
  // to avoid ISP / firewall ECONNRESET issues on raw TCP port 5432.
  if (sanitizedUrl.includes('neon.tech')) {
    try {
      const ws = require('ws');
      const neon = require('@neondatabase/serverless');
      neon.neonConfig.webSocketConstructor = ws;
      sequelizeOptions.dialectModule = neon;
    } catch (e) {
      console.warn('Note: @neondatabase/serverless not available, falling back to standard pg:', e.message);
    }
  }

  // Enable SSL for remote databases (like NeonDB)
  if (!isLocalhost) {
    sequelizeOptions.dialectOptions = {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      keepAlive: true
    };
  }

  sequelize = new Sequelize(sanitizedUrl, sequelizeOptions);
} else if (['development', 'test'].includes(process.env.NODE_ENV) || !process.env.NODE_ENV) {
  // Use separate SQLite file for test environment so tests never wipe active development data
  const isTest = process.env.NODE_ENV === 'test';
  const sqliteFile = isTest ? '../../eminence.test.sqlite' : '../../eminence.sqlite';
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.resolve(__dirname, sqliteFile),
    logging: false,
  });
} else {
  console.error('\n================================================================');
  console.error('ERROR: DATABASE_URL is not defined in environment variables.');
  console.error('Please configure your database connection inside backend/.env');
  console.error('================================================================\n');
  throw new Error('DATABASE_URL environment variable is required in production');
}

module.exports = sequelize;
