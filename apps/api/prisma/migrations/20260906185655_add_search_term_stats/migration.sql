-- CreateTable
CREATE TABLE "SearchTermStat" (
    "id" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "displayTerm" TEXT NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "noResultCount" INTEGER NOT NULL DEFAULT 0,
    "firstSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchTermStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchTermStat_normalizedTerm_key" ON "SearchTermStat"("normalizedTerm");

-- CreateIndex
CREATE INDEX "SearchTermStat_searchCount_idx" ON "SearchTermStat"("searchCount");

-- CreateIndex
CREATE INDEX "SearchTermStat_noResultCount_idx" ON "SearchTermStat"("noResultCount");
