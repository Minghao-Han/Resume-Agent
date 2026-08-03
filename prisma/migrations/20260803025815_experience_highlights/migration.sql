/*
  Warnings:

  - You are about to drop the column `action` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `quantify` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `situation` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `task` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `selectedExperienceIds` on the `GeneratedResume` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '',
    "situation" TEXT NOT NULL DEFAULT '',
    "task" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "quantify" TEXT NOT NULL DEFAULT '',
    "resumeBullet" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "experienceId" TEXT NOT NULL,
    CONSTRAINT "Highlight_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Experience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rawInput" TEXT NOT NULL,
    "chatHistory" TEXT NOT NULL DEFAULT '[]',
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Experience" ("chatHistory", "createdAt", "id", "org", "rawInput", "sessionId", "title", "type", "updatedAt") SELECT "chatHistory", "createdAt", "id", "org", "rawInput", "sessionId", "title", "type", "updatedAt" FROM "Experience";
DROP TABLE "Experience";
ALTER TABLE "new_Experience" RENAME TO "Experience";
CREATE TABLE "new_GeneratedResume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "jdSource" TEXT NOT NULL,
    "jdIsUrl" BOOLEAN NOT NULL DEFAULT false,
    "targetRoleTag" TEXT NOT NULL DEFAULT '',
    "typstSource" TEXT NOT NULL,
    "selectedHighlightIds" TEXT NOT NULL DEFAULT '[]',
    "chatHistory" TEXT NOT NULL DEFAULT '[]',
    "sessionId" TEXT,
    "pdfPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_GeneratedResume" ("chatHistory", "createdAt", "id", "jdIsUrl", "jdSource", "label", "pdfPath", "sessionId", "targetRoleTag", "typstSource") SELECT "chatHistory", "createdAt", "id", "jdIsUrl", "jdSource", "label", "pdfPath", "sessionId", "targetRoleTag", "typstSource" FROM "GeneratedResume";
DROP TABLE "GeneratedResume";
ALTER TABLE "new_GeneratedResume" RENAME TO "GeneratedResume";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
