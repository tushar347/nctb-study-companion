import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrCreateStudentByKey } from "@/lib/studentTracking";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const studentKey = String(
      body.studentKey ?? ""
    ).trim();

    const theme = String(
      body.theme ?? ""
    ).trim();

    if (!studentKey || !theme) {
      return NextResponse.json(
        {
          success:false,
          error:"studentKey and theme required",
        },
        {status:400}
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
          reward:{
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

