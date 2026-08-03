-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GeneratedResume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "jdSource" TEXT NOT NULL,
    "jdIsUrl" BOOLEAN NOT NULL DEFAULT false,
    "company" TEXT NOT NULL DEFAULT '',
    "targetRoleTag" TEXT NOT NULL DEFAULT '',
    "typstSource" TEXT NOT NULL,
    "selectedHighlightIds" TEXT NOT NULL DEFAULT '[]',
    "chatHistory" TEXT NOT NULL DEFAULT '[]',
    "sessionId" TEXT,
    "pdfPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_GeneratedResume" ("chatHistory", "createdAt", "id", "jdIsUrl", "jdSource", "label", "pdfPath", "selectedHighlightIds", "sessionId", "targetRoleTag", "typstSource") SELECT "chatHistory", "createdAt", "id", "jdIsUrl", "jdSource", "label", "pdfPath", "selectedHighlightIds", "sessionId", "targetRoleTag", "typstSource" FROM "GeneratedResume";
DROP TABLE "GeneratedResume";
ALTER TABLE "new_GeneratedResume" RENAME TO "GeneratedResume";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
