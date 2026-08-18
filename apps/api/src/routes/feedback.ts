import { Router } from "express"
import { z } from "zod"

import { supabase } from "../lib/supabase"

export const feedbackRouter: Router = Router()

/**
 * Shape of feedback payload, matching `feedback` table columns:
 * - user_id
 * - wallet_address
 * - username
 * - rating (1–5)
 * - message
 */
const createFeedbackSchema = z.object({
  // user_id: z.string().optional(),
  name: z.string().optional(),
  role: z.string().optional(),
  wallet_address: z.string().optional(),
  username: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  message: z.string().min(1, "Feedback message is required"),
})

/**
 * GET /feedback
 * List feedback entries.
 * Optional query params:
 *  - ?user_id=... to filter by user_id
 *  - ?limit=50 to limit number of rows (default 50, max 200)
 */
feedbackRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.query.user_id as string | undefined
    const limitParam = req.query.limit as string | undefined
    let limit = 50
    if (limitParam) {
      const parsed = Number(limitParam)
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 200)
      }
    }

    let query = supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (userId) {
      query = query.eq("user_id", userId)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Failed to fetch feedback: ${error.message}`)
    }

    return res.json({ feedback: data ?? [] })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /feedback
 * Create a new feedback entry.
 */
feedbackRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createFeedbackSchema.parse(req.body)

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        // user_id: parsed.user_id ?? null,
        name: parsed.name,
        role: parsed.role,
        wallet_address: parsed.wallet_address,
        username: parsed.username,
        rating: parsed.rating,
        message: parsed.message,
      })
      .select("*")
      .single()

    if (error) {
      throw new Error(`Failed to create feedback: ${error.message}`)
    }

    return res.status(201).json({ feedback: data })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.issues })
    }
    next(error)
  }
})

/**
 * DELETE /feedback/:id
 * Delete a feedback entry by primary key `id`.
 */
feedbackRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = req.params.id
    if (!id) {
      return res.status(400).json({ message: "Feedback id is required" })
    }

    // Check that the row exists
    const { data: existing, error: selectError } = await supabase
      .from("feedback")
      .select("*")
      .eq("id", id)
      .single()

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116 = No rows found
      throw new Error(`Failed to check feedback: ${selectError.message}`)
    }

    if (!existing) {
      return res.status(404).json({ message: "Feedback not found" })
    }

    const { error: deleteError } = await supabase
      .from("feedback")
      .delete()
      .eq("id", id)

    if (deleteError) {
      throw new Error(`Failed to delete feedback: ${deleteError.message}`)
    }

    return res.status(200).json({ message: "Feedback deleted", id })
  } catch (error) {
    next(error)
  }
})

