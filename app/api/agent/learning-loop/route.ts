import { useAiTeacherCredit } from "@/lib/rewardSystem";
import { buildLessonContext } from "@/lib/buildLessonContext";
import { buildPageContext } from "@/lib/buildPageContext";

import {
  getMemorySummaryForAgent,
  logResearchEvent,
  saveChatMessage,
  updateMemoryAfterAgent,
} from "@/lib/researchDb";

export const runtime = "nodejs";

type RequestedTool =
  | "simple"
  | "bangla"
  | "grammar"
  | "quiz"
  | "chat";

type RequestBody = {
  studentId?: string;
  studentKey?: string;
  lessonNo: number;
  selectedLine: string;
  requestedTool: RequestedTool;
  studentQuestion?: string;
  pageNumber?: number;
  lineId?: string;
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
};


function fallbackAnswer(
  tool: RequestedTool,
  selectedLine: string,
) {
  return {
    tool,
    output:
      "AI is not configured yet. Add GEMINI_API_KEY in .env.local and restart the server.",
    selectedLine,
  };
}


function buildPrompt({
  requestedTool,
  selectedLine,
  studentQuestion,
  lessonTitle,
  nearbyContext,
  memorySummary,
}: {
  requestedTool: RequestedTool;
  selectedLine: string;
  studentQuestion?: string;
  lessonTitle: string;
  nearbyContext: string;
  memorySummary: unknown;
}) {

  return `
You are an AI Teacher for Class 6 English textbook learners in Bangladesh.

Lesson title:
${lessonTitle}

Selected textbook line:
${selectedLine}

Nearby textbook context:
${nearbyContext}

Student memory:
${JSON.stringify(memorySummary, null, 2)}

Tool:
${requestedTool}

Student question:
${studentQuestion ?? "No question"}

Rules:
- Explain simply.
- Use examples.
- Help Class 6 students understand.
- Keep answers short and useful.
`;
}


export async function POST(
  request: Request,
) {

  try {

    const body =
      (await request.json()) as RequestBody;


    const studentKey =
      String(
        body.studentKey ??
        body.studentId ??
        "",
      ).trim();


    if (
      !studentKey ||
      !body.lessonNo ||
      !body.selectedLine ||
      !body.requestedTool
    ) {

      return Response.json(
        {
          error:
            "studentKey/studentId, lessonNo, selectedLine, and requestedTool are required",
        },
        {
          status:400,
        },
      );

    }



    /*
      AI ACCESS

      Unlimited mode enabled.
      We still call credit system because it logs usage.
      No blocking.
    */

    const creditResult =
      await useAiTeacherCredit({

        studentKey,

        lessonNo:
          Number(body.lessonNo),

        selectedLine:
          body.selectedLine,

        question:
          body.studentQuestion,

        toolUsed:
          body.requestedTool,

      });



    const wallet =
      creditResult.wallet;



    const lessonContext =
      body.pageNumber

      ? await buildPageContext({

          pageNumber:
            Number(body.pageNumber),

          lineId:
            body.lineId,

          fallbackSelectedLine:
            body.selectedLine,

          fallbackLessonNo:
            Number(body.lessonNo),

        })

      : buildLessonContext(
          Number(body.lessonNo),
          body.selectedLine,
        );




    await Promise.all([

      updateMemoryAfterAgent({

        studentKey,

        lessonNo:
          Number(body.lessonNo),

        selectedLine:
          body.selectedLine,

        toolUsed:
          body.requestedTool,

      }),



      logResearchEvent({

        studentKey,

        lessonNo:
          Number(body.lessonNo),

        eventType:
          "agent_tool_request",

        selectedLine:
          body.selectedLine,

        toolUsed:
          body.requestedTool,

        metadata:{
          studentQuestion:
            body.studentQuestion ?? null,

          unlimitedAI:
            true,
        },

      }),

    ]);



    const memorySummary =
      await getMemorySummaryForAgent(
        studentKey,
      );



    const apiKey =
      process.env.GEMINI_API_KEY;



    const model =
      process.env.GEMINI_MODEL ??
      "gemini-2.5-flash";




    if(!apiKey){

      const fallback =
        fallbackAnswer(
          body.requestedTool,
          body.selectedLine,
        );


      await saveChatMessage({

        studentKey,

        lessonNo:
          Number(body.lessonNo),

        selectedLine:
          body.selectedLine,

        toolUsed:
          body.requestedTool,

        question:
          body.studentQuestion,

        answer:
          fallback.output,

        source:
          "fallback",

      });



      return Response.json({

        success:true,

        result:{
          ...fallback,

          lessonNo:
            Number(body.lessonNo),

          lessonTitle:
            lessonContext.lessonTitle,
        },


        source:
          "fallback",

        memory:
          memorySummary,


        wallet,

        unlimited:true,

      });

    }




    const prompt =
      buildPrompt({

        requestedTool:
          body.requestedTool,

        selectedLine:
          body.selectedLine,

        studentQuestion:
          body.studentQuestion,

        lessonTitle:
          lessonContext.lessonTitle,

        nearbyContext:
          lessonContext.nearbyContext,

        memorySummary,

      });



    const geminiResponse =
      await fetch(

        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,

        {

          method:"POST",

          headers:{
            "Content-Type":
              "application/json",
          },

          body:JSON.stringify({

            contents:[

              {

                role:"user",

                parts:[

                  {
                    text:prompt,
                  },

                ],

              },

            ],

            generationConfig:{

              temperature:
                0.3,

            },

          }),

        },

      );




    if(!geminiResponse.ok){

      const fallback =
        fallbackAnswer(
          body.requestedTool,
          body.selectedLine,
        );


      return Response.json({

        success:true,

        result:fallback,

        source:
          "fallback",

        wallet,

        unlimited:true,

      });

    }




   const geminiData = (await geminiResponse.json()) as GeminiResponse;



    const output =

      geminiData
      .candidates?.[0]
      ?.content
      ?.parts

      ?.map(
        p =>
          p.text ?? "",
      )

      .join("")

      .trim()

      ??
      "No response generated.";





    await saveChatMessage({

      studentKey,

      lessonNo:
        Number(body.lessonNo),

      selectedLine:
        body.selectedLine,

      toolUsed:
        body.requestedTool,

      question:
        body.studentQuestion,

      answer:
        output,

      source:
        "gemini",

    });





    return Response.json({

      success:true,


      result:{

        tool:
          body.requestedTool,

        output,

        selectedLine:
          body.selectedLine,

        lessonNo:
          Number(body.lessonNo),

        lessonTitle:
          lessonContext.lessonTitle,

      },


      source:
        "gemini",


      retrieval:{

        method:
          body.pageNumber
          ? "live-ocr-page"
          : "legacy-mock-lesson",


        pageNumber:
          body.pageNumber ?? null,


        contextUsed:
          lessonContext.nearbyContext,

      },


      memory:
        memorySummary,


      wallet,


      unlimited:true,


    });



  } catch(error){

    return Response.json(

      {

        error:
          "Agentic learning loop failed",

        detail:
          error instanceof Error
          ? error.message
          : "Unknown error",

      },

      {
        status:500,
      },

    );

  }

}