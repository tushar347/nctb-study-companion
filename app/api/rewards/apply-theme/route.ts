import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrCreateStudentByKey } from "@/lib/studentTracking";
import { getSessionStudentKey } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const studentKey = await getSessionStudentKey();
    if (!studentKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 },
      );
    }

    const theme = String(
      body.theme ?? ""
    ).trim();

    if (!["violet", "emerald"].includes(theme)) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose a valid theme.",
        },
        { status: 400 }
      );
    }

    const student =
      await findOrCreateStudentByKey(
        studentKey
      );

    const inventory =
      await prisma.studentReward.findFirst({
        where:{
          studentId:student.id,
          rewardItem:{
            code:
              theme === "violet"
              ? "THEME_VIOLET"
              : "THEME_EMERALD"
          }
        }
      });


    if(!inventory){
      return NextResponse.json(
        {
          success:false,
          error:"Theme not owned"
        },
        {status:403}
      );
    }


    await prisma.student.update({
      where:{
        id:student.id,
      },
      data:{
        avatarTheme:theme,
      }
    });


    return NextResponse.json({
      success:true,
      theme,
    });


  } catch(error){

    return NextResponse.json(
      {
        success:false,
        error:
        error instanceof Error
        ? error.message
        :"Failed"
      },
      {
        status:500
      }
    );
  }
}
