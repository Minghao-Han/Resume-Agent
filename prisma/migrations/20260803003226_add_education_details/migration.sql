-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Education" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "school" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "relevantCourses" TEXT NOT NULL DEFAULT '',
    "gpa" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "personalInfoId" INTEGER NOT NULL,
    CONSTRAINT "Education_personalInfoId_fkey" FOREIGN KEY ("personalInfoId") REFERENCES "PersonalInfo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Education" ("degree", "endDate", "id", "major", "personalInfoId", "school", "sortOrder", "startDate") SELECT "degree", "endDate", "id", "major", "personalInfoId", "school", "sortOrder", "startDate" FROM "Education";
DROP TABLE "Education";
ALTER TABLE "new_Education" RENAME TO "Education";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
