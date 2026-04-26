ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "categoryId" INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_categoryId_fkey') THEN
    ALTER TABLE "Loan" ADD CONSTRAINT "Loan_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
