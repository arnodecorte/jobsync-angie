# JobSync AI Agent Instructions

This document provides essential context for AI agents working on the JobSync codebase.

## Architecture Overview

JobSync is a full-stack application built with Next.js (App Router) and a SQLite database.

-   **Frontend**: Built with React Server Components (RSC) and Client Components (`"use client"`). The UI is constructed using **shadcn/ui** and **Tailwind CSS**. Forms are managed by **React Hook Form** (`@hookform/resolvers`) with **Zod** for schema validation.
-   **Backend**: Business logic is handled by **Next.js Server Actions** located in `src/actions/`. These actions are the primary way the frontend interacts with the database.
-   **Database**: Uses **SQLite** via the **Prisma ORM**. The database schema is the source of truth and is defined in `prisma/schema.prisma`.
-   **Authentication**: Implemented using **NextAuth.js v5** with a Credentials provider. Key files are `src/auth.ts` and `src/auth.config.ts`.
-   **AI Integration**: Uses **LangChain.js** to interact with large language models. It defaults to a local **Ollama** instance but can be configured to use **OpenAI**. AI-related logic is in `src/actions/ai.actions.ts`.
-   **Python Scraper**: A Python script at `tools/scraper/scraper.py` uses Selenium to scrape job details from LinkedIn. It is executed by a Next.js API Route Handler at `src/app/api/scrape-job-details/route.ts`.

## Key Developer Workflows

- The developer is a non-expert in most areas and is currently using this to build career capital and gain skills. Take this into account when suggesting solutions, ensuring they are clear and explained well for a beginner.
- Make suggestions that foster the mentality of a seasoned and professional developer, and explain the reasoning behind them.

### Database Migrations

This is the most critical workflow. When you change a model in `prisma/schema.prisma`, you **must** update the database and the Prisma Client.

1.  **Modify the schema**: Edit `prisma/schema.prisma`.
2.  **Generate the client**: `npx prisma generate`
3.  **Create and apply the migration**: `npx prisma migrate dev`

### Seeding Initial Data

The application requires initial data for things like job statuses. To seed the database, run:

```bash
npm run seed
```

This executes the `prisma/seed.js` script.

### Running the Application

-   **Local Development**: Use `npm run dev`. This runs the app on `http://localhost:3000`.
-   **Docker**: The recommended way to run the full stack, including the Python environment for the scraper.
    ```bash
    docker compose up
    ```

## Code Conventions & Patterns

### Server Actions for Data Mutation

Almost all database reads and writes are handled through Server Actions in `src/actions/`. For example, to add a job, the frontend calls `addJob` from `src/actions/job.actions.ts`. These actions are defined with `"use server";`.

```typescript
// Example from src/actions/job.actions.ts
"use server";
// ...
export async function addJob(data: AddJobFormValues) {
  // ... validation and Prisma logic
  await prisma.job.create({ ... });
}
```

### "Creatable" Combobox Pattern

Many forms use a `Combobox` for fields like "Company" or "Job Title". These components allow users to either select an existing entry from the database or type a new one.

When implementing this pattern, the server action must handle both cases:
1.  If the submitted value is a UUID, use it to connect to an existing record.
2.  If the submitted value is a string (the new name), the action must first create the new `Company` or `JobTitle` record, get its new ID, and then use that ID to create the `Job`.

### Python Scraper Communication

The API route at `src/app/api/scrape-job-details/route.ts` uses Node.js `child_process.spawn` to run the Python scraper.
-   **Data Output**: The Python script must print the final scraped data as a single JSON string to `stdout`.
-   **Logs & Errors**: All logging, status messages, and errors in the Python script must be written to `stderr` (`print("message", file=sys.stderr)`) to avoid contaminating the JSON output.
