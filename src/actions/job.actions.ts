"use server";

import { z } from "zod";
import { AddJobFormSchema } from "@/models/addJobForm.schema";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db"; // Use default import
import { v4 as uuidv4 } from "uuid";
import { JOB_TYPES, JobStatus } from "@/models/job.model";
import { handleError } from "@/lib/utils";
import { auth } from "@/auth";

// --- START OF CHANGES ---
// Define an explicit return type for the action
type FindOrCreateResult =
  | { success: true; data: { titleId: string; companyId: string; locationId: string } }
  | { success: false; message: string };
// --- END OF CHANGES ---

// This is our new action
export async function findOrCreateEntities(
  entities: {
    title: string;
    company: string;
    location: string;
  }
): Promise<FindOrCreateResult | undefined> { // Apply the explicit return type
  try {
    const session = await auth();
    const user = session?.user;
    if (!user || !user.id) {
      throw new Error("Not authenticated");
    }

    const titleId = await getOrCreateId("jobTitle", entities.title, user.id);
    const companyId = await getOrCreateId(
      "company",
      entities.company,
      user.id
    );
    const locationId = await getOrCreateId(
      "location",
      entities.location,
      user.id
    );

    return {
      success: true,
      data: {
        titleId,
        companyId,
        locationId,
      },
    };
  } catch (error) {
    // Manually construct the error object to match the FindOrCreateResult type
    console.error("Failed to find or create entities.", error);
    const message =
      error instanceof Error
        ? error.message
        : "An unknown error occurred.";
    return { success: false, message: `Failed to process entities: ${message}` };
  }
}

// Helper function to check if a string is a UUID
function isUUID(str: string) {
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(str);
}

// Helper function to find an entity by name or create it if it doesn't exist
async function getOrCreateId(
  model: "jobTitle" | "company" | "location",
  name: string,
  userId: string
) {
  if (isUUID(name)) {
    return name; // It's already an ID, so just return it.
  }

  // It's a string name, so let's find or create it.
  const existing = await (prisma as any)[model].findFirst({
    where: { label: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    return existing.id;
  }

  // Doesn't exist, so create it.
  const newEntity = await (prisma as any)[model].create({
    data: {
      id: uuidv4(),
      label: name,
      value: name.toLowerCase(),
      createdBy: userId,
    },
  });
  return newEntity.id;
}

export const getStatusList = async (): Promise<any | undefined> => {
  try {
    const statuses = await prisma.jobStatus.findMany();
    return statuses;
  } catch (error) {
    const msg = "Failed to fetch status list. ";
    return handleError(error, msg);
  }
};

export const getJobSourceList = async (): Promise<any | undefined> => {
  try {
    const list = await prisma.jobSource.findMany();
    return list;
  } catch (error) {
    const msg = "Failed to fetch job source list. ";
    return handleError(error, msg);
  }
};

export const getJobsList = async (
  page = 1,
  limit = 10,
  filter?: string
): Promise<any | undefined> => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user || !user.id) {
      throw new Error("Not authenticated");
    }
    const skip = (page - 1) * limit;

    const filterBy = filter
      ? filter === Object.keys(JOB_TYPES)[1]
        ? {
            jobType: filter,
          }
        : {
            Status: {
              value: filter,
            },
          }
      : {};
    const [data, total] = await Promise.all([
      prisma.job.findMany({
        where: {
          userId: user.id,
          ...filterBy,
        },
        skip,
        take: limit,
        select: {
          id: true,
          JobSource: true,
          JobTitle: true,
          jobType: true,
          Company: true,
          Status: true,
          Location: true,
          dueDate: true,
          appliedDate: true,
          description: false,
          Resume: true,
        },
        orderBy: {
          createdAt: "desc",
          // appliedDate: "desc",
        },
      }),
      prisma.job.count({
        where: {
          userId: user.id,
          ...filterBy,
        },
      }),
    ]);
    return { success: true, data, total };
  } catch (error) {
    const msg = "Failed to fetch jobs list. ";
    return handleError(error, msg);
  }
};

export async function* getJobsIterator(filter?: string, pageSize = 200) {
  const session = await auth();
  const user = session?.user;
  if (!user || !user.id) {
    throw new Error("Not authenticated");
  }
  let page = 1;
  let fetchedCount = 0;

  while (true) {
    const skip = (page - 1) * pageSize;
    const filterBy = filter
      ? filter === Object.keys(JOB_TYPES)[1]
        ? { status: filter }
        : { type: filter }
      : {};

    const chunk = await prisma.job.findMany({
      where: {
        userId: user.id,
        ...filterBy,
      },
      select: {
        id: true,
        createdAt: true,
        JobSource: true,
        JobTitle: true,
        jobType: true,
        Company: true,
        Status: true,
        Location: true,
        dueDate: true,
        applied: true,
        appliedDate: true,
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    });

    if (!chunk.length) {
      break;
    }

    yield chunk;
    fetchedCount += chunk.length;
    page++;
  }
}

export const getJobDetails = async (
  jobId: string
): Promise<any | undefined> => {
  try {
    if (!jobId) {
      throw new Error("Please provide job id");
    }
    const session = await auth();
    const user = session?.user;

    if (!user) {
      throw new Error("Not authenticated");
    }

    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        JobSource: true,
        JobTitle: true,
        Company: true,
        Status: true,
        Location: true,
        Resume: {
          include: {
            File: true,
          },
        },
      },
    });
    return { job, success: true };
  } catch (error) {
    const msg = "Failed to fetch job details. ";
    return handleError(error, msg);
  }
};

export const createLocation = async (
  label: string
): Promise<any | undefined> => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user || !user.id) {
      throw new Error("Not authenticated");
    }

    const value = label.trim().toLowerCase();

    if (!value) {
      throw new Error("Please provide location name");
    }

    const location = await prisma.location.create({
      data: { label, value, createdBy: user.id },
    });

    return { data: location, success: true };
  } catch (error) {
    const msg = "Failed to create job location. ";
    return handleError(error, msg);
  }
};

export async function addJob(data: z.infer<typeof AddJobFormSchema>) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user || !user.id) {
      return { success: false, message: "Not authenticated" };
    }

    // Resolve names to IDs for relational fields
    const titleId = await getOrCreateId("jobTitle", data.title, user.id);
    const companyId = await getOrCreateId("company", data.company, user.id);
    const locationId = await getOrCreateId("location", data.location, user.id);

    await prisma.job.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        jobType: data.type,
        description: data.jobDescription,
        applied: data.applied ?? false,
        appliedDate: data.dateApplied,
        statusId: data.status,
        jobTitleId: titleId, // Use the resolved ID
        companyId: companyId, // Use the resolved ID
        locationId: locationId, // Use the resolved ID
        jobSourceId: data.source,
        salaryRange: data.salaryRange,
        dueDate: data.dueDate,
        jobUrl: data.jobUrl,
        resumeId: data.resume,
        createdAt: new Date(),
      },
    });

    revalidatePath("/dashboard/myjobs");
    return { success: true, message: "Job created successfully" };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Failed to create job" };
  }
}

export const updateJob = async (
  data: z.infer<typeof AddJobFormSchema>
): Promise<any | undefined> => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user || !user.id) {
      throw new Error("Not authenticated");
    }
    if (!data.id || user.id != data.userId) {
      throw new Error("Id is not provide or no user privilages");
    }

    const {
      id,
      type,
      status,
      source,
      salaryRange,
      dueDate,
      dateApplied,
      jobDescription,
      jobUrl,
      applied,
      resume,
    } = data;

    // Resolve names to IDs for relational fields
    const titleId = await getOrCreateId("jobTitle", data.title, user.id);
    const companyId = await getOrCreateId("company", data.company, user.id);
    const locationId = await getOrCreateId("location", data.location, user.id);

    const job = await prisma.job.update({
      where: {
        id,
      },
      data: {
        jobTitleId: titleId,
        companyId: companyId,
        locationId: locationId,
        statusId: status,
        jobSourceId: source,
        salaryRange: salaryRange,
        dueDate: dueDate,
        appliedDate: dateApplied,
        description: jobDescription,
        jobType: type,
        jobUrl,
        applied,
        resumeId: resume,
      },
    });
    revalidatePath("/dashboard/myjobs");
    return { job, success: true };
  } catch (error) {
    const msg = "Failed to update job. ";
    return handleError(error, msg);
  }
};

export const updateJobStatus = async (
  jobId: string,
  status: JobStatus
): Promise<any | undefined> => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user || !user.id) {
      throw new Error("Not authenticated");
    }
    const dataToUpdate = () => {
      switch (status.value) {
        case "applied":
          return {
            statusId: status.id,
            applied: true,
            appliedDate: new Date(),
          };
        case "interview":
          return {
            statusId: status.id,
            applied: true,
          };
        default:
          return {
            statusId: status.id,
          };
      }
    };

    const job = await prisma.job.update({
      where: {
        id: jobId,
        userId: user.id,
      },
      data: dataToUpdate(),
    });
    return { job, success: true };
  } catch (error) {
    const msg = "Failed to update job status.";
    return handleError(error, msg);
  }
};

export const deleteJobById = async (
  jobId: string
): Promise<any | undefined> => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user || !user.id) {
      throw new Error("Not authenticated");
    }

    const res = await prisma.job.delete({
      where: {
        id: jobId,
        userId: user.id,
      },
    });
    return { res, success: true };
  } catch (error) {
    const msg = "Failed to delete job.";
    return handleError(error, msg);
  }
};
