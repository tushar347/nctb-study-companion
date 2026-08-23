import { prisma } from "@/lib/prisma";
import { findOrCreateStudentByKey } from "@/lib/studentTracking";

export const POINTS_PER_AI_CREDIT = 10;


/**
 * Get student wallet
 */
export async function getOrCreateStudentWallet(
  studentKey: string,
) {
  const student =
    await findOrCreateStudentByKey(studentKey);


  const wallet =
    await prisma.studentWallet.upsert({
      where: {
        studentId: student.id,
      },

      update: {},

      create: {
        studentId: student.id,
        aiCredits: 999999,
        learningPoints: 0,
        lifetimePointsEarned: 0,
        lifetimeCreditsUsed: 0,
      },
    });


  return {
    student,
    wallet,
  };
}



/**
 * Award learning points
 */
export async function awardLearningPoints(
  input: {
    studentKey: string;
    points: number;
    reason: string;
    metadata?: unknown;
  },
) {

  const points =
    Math.max(
      0,
      Math.floor(input.points),
    );


  const { student } =
    await getOrCreateStudentWallet(
      input.studentKey,
    );


  const wallet =
    await prisma.studentWallet.update({
      where:{
        studentId: student.id,
      },

      data:{
        learningPoints:{
          increment: points,
        },

        lifetimePointsEarned:{
          increment: points,
        },
      },
    });



  const transaction =
    await prisma.rewardTransaction.create({

      data:{
        studentId: student.id,

        type:"EARN_POINTS",

        pointsChange: points,

        creditsChange:0,

        reason: input.reason,

        metadataJson:
          input.metadata
            ? JSON.stringify(input.metadata)
            : undefined,
      },

    });



  return {
    student,
    wallet,
    transaction,
    pointsAwarded: points,
  };

}




/**
 * Redeem points for AI credits
 * Kept for reward system compatibility
 */
export async function redeemPointsForAiCredits(
  input:{
    studentKey:string;
    credits:number;
  },
) {

  const credits =
    Math.max(
      1,
      Math.floor(input.credits),
    );


  const pointsNeeded =
    credits * POINTS_PER_AI_CREDIT;



  const {
    student,
    wallet,
  } =
    await getOrCreateStudentWallet(
      input.studentKey,
    );



  if(wallet.learningPoints < pointsNeeded){

    return {
      success:false,

      error:
        `Not enough learning points. Need ${pointsNeeded} points.`,

      wallet,

      pointsNeeded,
    };

  }



  const updatedWallet =
    await prisma.studentWallet.update({

      where:{
        studentId:student.id,
      },

      data:{
        learningPoints:{
          decrement:pointsNeeded,
        },

        aiCredits:{
          increment:credits,
        },

      },

    });



  const transaction =
    await prisma.rewardTransaction.create({

      data:{

        studentId:student.id,

        type:"REDEEM_POINTS",

        pointsChange:-pointsNeeded,

        creditsChange:credits,

        reason:
          `Redeemed ${pointsNeeded} points for ${credits} AI credits.`,

      },

    });



  return {

    success:true,

    student,

    wallet:updatedWallet,

    transaction,

    pointsUsed:pointsNeeded,

    creditsAdded:credits,

  };

}




/**
 * AI Teacher usage
 * DEMO MODE:
 * Unlimited usage
 */
export async function useAiTeacherCredit(
  input:{
    studentKey:string;
    lessonNo?:number;
    selectedLine?:string;
    question?:string;
    toolUsed?:string;
  },
){

  const {
    student,
    wallet,
  } =
    await getOrCreateStudentWallet(
      input.studentKey,
    );



  const usageLog =
    await prisma.aiUsageLog.create({

      data:{

        studentId:student.id,

        lessonNo:input.lessonNo,

        selectedLine:input.selectedLine,

        question:input.question,

        toolUsed:input.toolUsed,

        creditsUsed:0,

      },

    });



  return {

    success:true,

    student,

    wallet,

    usageLog,

    unlimited:true,

  };

}