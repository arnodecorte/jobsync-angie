import { z } from "zod";

export const AddJobFormSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  // Allow title, company, and location to be a plain string (for new entries)
  // or a UUID string (for existing selections). The backend will figure it out.
  title: z.string().min(1, "Job title is required"),
  company: z.string().min(1, "Company is required"),
  location: z.string().min(1, "Location is required"),
  jobUrl: z.string().url().optional().or(z.literal("")),
  type: z.string(),
  source: z
    .string({
      required_error: "Source is required.",
    })
    .min(2, {
      message: "Source name must be at least 2 characters.",
    }),
  status: z
    .string({
      required_error: "Status is required.",
    })
    .min(2, {
      message: "Status must be at least 2 characters.",
    })
    .default("draft"),
  dueDate: z.date(),
  /**
   * Note: Timezone offsets can be allowed by setting the offset option to true.
   * z.string().datetime({ offset: true });
   */
  //
  dateApplied: z.date().optional(),
  salaryRange: z.string(),
  jobDescription: z
    .string({
      required_error: "Job description is required.",
    })
    .min(10, {
      message: "Job description must be at least 10 characters.",
    }),
  resume: z.string().optional(),
  applied: z.boolean().default(false),
});
