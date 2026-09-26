import { JSONFilePreset } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

// DATABASE PATH
const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

const DB_FILE = path.join(
  __dirname,
  "data",
  "db.json"
);

// MONTH SEQUENCE
const MONTH_SEQUENCE = [
  {
    key: "2025-12",
    label: "December 2025",
  },
  {
    key: "2026-01",
    label: "January 2026",
  },
  {
    key: "2026-02",
    label: "February 2026",
  },
  {
    key: "2026-03",
    label: "March 2026",
  },
  {
    key: "2026-04",
    label: "April 2026",
  },
  {
    key: "2026-05",
    label: "May 2026",
  },
];

// HOUSEHOLD CREATOR
function household(
  id,
  name,
  username,
  email,
  barangay,
  history,
  status = "Active",
  accountType = "Residential — Standard"
) {
  return {
    id,
    name,
    username,
    email,
    barangay,
    accountType,
    status,

    history: MONTH_SEQUENCE.map(
      (m, i) => ({
        monthKey: m.key,
        month: m.label,
        consumption: history[i],
      })
    ),

    forecast: null,
  };
}

// SEED DATABASE
function seedData() {
  return {
    // HOUSEHOLDS
    households: [
      household(
        "HH-001",
        "Juan Dela Cruz",
        "juan",
        "juan@email.com",
        "Bacao II, General Trias, Cavite",
        [16, 19, 17, 18, 22, 20]
      ),

      household(
        "HH-002",
        "Maria Santos",
        "maria",
        "maria@email.com",
        "Bacao II, General Trias, Cavite",
        [15, 16, 17, 16, 19, 18]
      ),

      household(
        "HH-003",
        "Richard Cadigal",
        "richard",
        "richard@email.com",
        "Bacao I, General Trias, Cavite",
        [18, 20, 19, 21, 23, 22]
      ),

      household(
        "HH-004",
        "Pedro Garcia",
        "pedro",
        "pedro@email.com",
        "Bacao I, General Trias, Cavite",
        [14, 15, 16, 15, 18, 17],
        "Inactive"
      ),

      household(
        "HH-005",
        "Ana Reyes",
        "ana",
        "ana@email.com",
        "Tejero, General Trias, Cavite",
        [17, 17, 18, 17, 20, 19]
      ),
    ],

    // USERS
    users: [
      {
        name: "Juan Dela Cruz",
        username: "juan",
        email: "juan@email.com",
        role: "resident",
        status: "Active",
        password: "password123",
      },

      {
        name: "Maria Santos",
        username: "maria",
        email: "maria@email.com",
        role: "resident",
        status: "Active",
        password: "password123",
      },

      {
        name: "Admin User",
        username: "admin",
        email: "admin@email.com",
        role: "admin",
        status: "Active",
        password: "admin123",
      },

      {
        name: "Pedro Garcia",
        username: "pedro",
        email: "pedro@email.com",
        role: "resident",
        status: "Inactive",
        password: "password123",
      },

      {
        name: "Ana Reyes",
        username: "ana",
        email: "ana@email.com",
        role: "resident",
        status: "Active",
        password: "password123",
      },
    ],

    // SYSTEM SETTINGS
    settings: {
      threshold: 25,
      emailAlerts: true,
      autoForecast: true,
    },
  };
}

// GET DATABASE
export async function getDb() {
  const db = await JSONFilePreset(
    DB_FILE,
    seedData()
  );

  return db;
}

// RESET DATABASE
export function resetDb(db) {
  db.data = seedData();

  return db.write();
}

// EXPORT MONTH DATA
export { MONTH_SEQUENCE };