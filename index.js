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
  res.send("Gama Dynamics API running 🚀");
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


app.post("/color-coach", async (req, res) => {
  try {
    const providedKey = req.header("x-pvd-ai-key");
    const expectedKey = process.env.PVD_AI_KEY;

    if (expectedKey && providedKey !== expectedKey) {
      return res.status(401).json({
        message: "Unauthorized Color Coach request.",
      });
    }

    const { prompt, request } = req.body ?? {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        message: "OPENAI_API_KEY is not configured on the server.",
      });
    }

    if (!request || typeof request !== "object") {
      return res.status(400).json({
        message: "A Color Coach request payload is required.",
      });
    }

    const requiredNumbers = [
      "targetL",
      "targetA",
      "targetB",
      "measuredL",
      "measuredA",
      "measuredB",
      "toleranceL",
      "toleranceA",
      "toleranceB",
    ];

    for (const key of requiredNumbers) {
      if (typeof request[key] !== "number" || Number.isNaN(request[key])) {
        return res.status(400).json({
          message: `Invalid or missing numeric value: ${key}`,
        });
      }
    }

    const targetColorName =
      typeof request.targetColorName === "string" && request.targetColorName.trim().length > 0
        ? request.targetColorName.trim()
        : "Unknown color";

    const systemPrompt = `
  You are Color Coach, a practical PVD color correction assistant for CIE L*a*b* readings.

  You help an operator reason about how to move from a measured LAB result toward a target LAB result.

  Rules:
  - Be practical, conservative, and operator-friendly.
  - The operator can mainly tweak nitrogen N2 and acetylene C2H2.
  - Do not pretend a correction is guaranteed.
  - Do not invent machine-specific settings.
  - Keep recommendations as directional guidance, not exact proprietary recipes.
  - Prioritise keeping any LAB axis already inside tolerance stable.
  - Include fallback scenarios so the user gets multiple next moves in one API call.
  - Return only valid JSON.
  `.trim();

    const fallbackPrompt = `
  Target color: ${targetColorName}
  Target LAB: L ${request.targetL}, a ${request.targetA}, b ${request.targetB}
  Measured LAB: L ${request.measuredL}, a ${request.measuredA}, b ${request.measuredB}
  Tolerance: L ±${request.toleranceL}, a ±${request.toleranceA}, b ±${request.toleranceB}
  Current nitrogen N2: ${request.currentNitrogen ?? "not provided"}
  Current acetylene C2H2: ${request.currentAcetylene ?? "not provided"}
  Operator notes: ${request.operatorNotes || "none"}

  Explain what is outside tolerance, what should be protected, and what direction the next test should move.

  Return JSON with this exact shape:
  {
    "diagnosis": "string",
    "nextStep": "string",
    "gasRecommendation": "string",
    "fallbackScenarios": [
      {
        "scenario": "string",
        "action": "string",
        "reason": "string"
      }
    ],
    "confidence": "low | medium | high",
    "safetyNote": "string"
  }
  `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            typeof prompt === "string" && prompt.trim().length > 0
              ? prompt.trim()
              : fallbackPrompt,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({
        message: "OpenAI returned an empty Color Coach response.",
      });
    }

    const parsed = JSON.parse(content);

    return res.json({
      diagnosis: parsed.diagnosis ?? "No diagnosis returned.",
      nextStep: parsed.nextStep ?? "Run a conservative color test before production.",
      gasRecommendation: parsed.gasRecommendation ?? "No gas recommendation returned.",
      fallbackScenarios: Array.isArray(parsed.fallbackScenarios)
        ? parsed.fallbackScenarios.map((item) => ({
            scenario: item?.scenario ?? "Unexpected result",
            action: item?.action ?? "Review the result and make a smaller correction.",
            reason: item?.reason ?? "The response did not include a reason.",
          }))
        : [],
      confidence: parsed.confidence ?? "medium",
      safetyNote:
        parsed.safetyNote ??
        "AI advice is a correction guide only. Validate with a color test and operator judgement before production.",
    });
  } catch (error) {
    console.error("color-coach error:", error);

    return res.status(500).json({
      message: "Failed to generate Color Coach plan.",
    });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Gama Dynamics API running on port ${PORT}`);
});