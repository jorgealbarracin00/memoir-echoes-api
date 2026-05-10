import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Memoir Echoes API running 🚀");
});

app.post("/generate-echo", async (req, res) => {
  try {
    const {
      transcript,
      mood = "reflective",
      spark = "",
      narrativeVoice = "",
    } = req.body ?? {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured on the server.",
      });
    }

    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      return res.status(400).json({
        error: "A transcript is required.",
      });
    }

    const systemPrompt = `
You are Memoir Echoes, an emotionally intelligent memoir-writing assistant.
Your job is to transform a user's spoken memory into a polished memoir Echo.

Rules:
- Preserve the user's meaning and emotional truth.
- Do not invent major facts.
- Improve clarity, flow, atmosphere, and literary quality.
- Keep the writing human, intimate, and grounded.
- Respect the selected mood.
- Return only valid JSON.
`.trim();

    const userPrompt = `
Selected mood: ${mood}

Narrative voice notes:
${narrativeVoice || "No narrator profile yet."}

Spark context, if any:
${spark || "No Spark provided."}

Transcript:
${transcript.trim()}

Return JSON with this exact shape:
{
  "title": "short emotional title",
  "echo": "polished memoir-style version of the memory",
  "summary": "one sentence summary",
  "tags": ["short lowercase tags"],
  "people": ["detected people names or roles"],
  "places": ["detected places"],
  "timePeriod": "detected time period or empty string",
  "narratorObservation": "one small storytelling-style observation about the narrator, not a psychological diagnosis"
}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.75,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({
        error: "OpenAI returned an empty response.",
      });
    }

    const parsed = JSON.parse(content);

    return res.json({
      title: parsed.title ?? "Untitled Echo",
      echo: parsed.echo ?? "",
      summary: parsed.summary ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      people: Array.isArray(parsed.people) ? parsed.people : [],
      places: Array.isArray(parsed.places) ? parsed.places : [],
      timePeriod: parsed.timePeriod ?? "",
      narratorObservation: parsed.narratorObservation ?? "",
    });
  } catch (error) {
    console.error("generate-echo error:", error);

    return res.status(500).json({
      error: "Failed to generate Echo.",
    });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Memoir Echoes API running on port ${PORT}`);
});