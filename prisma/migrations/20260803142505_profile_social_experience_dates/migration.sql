-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Experience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TEXT NOT NULL DEFAULT '',
    "endDate" TEXT NOT NULL DEFAULT '',
    "rawInput" TEXT NOT NULL,
    "chatHistory" TEXT NOT NULL DEFAULT '[]',
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Experience" ("chatHistory", "createdAt", "id", "org", "rawInput", "sessionId", "title", "type", "updatedAt") SELECT "chatHistory", "createdAt", "id", "org", "rawInput", "sessionId", "title", "type", "updatedAt" FROM "Experience";
DROP TABLE "Experience";
ALTER TABLE "new_Experience" RENAME TO "Experience";
CREATE TABLE "new_PersonalInfo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "github" TEXT NOT NULL DEFAULT '',
    "linkedin" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PersonalInfo" ("email", "id", "location", "name", "phone", "updatedAt") SELECT "email", "id", "location", "name", "phone", "updatedAt" FROM "PersonalInfo";
DROP TABLE "PersonalInfo";
ALTER TABLE "new_PersonalInfo" RENAME TO "PersonalInfo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
