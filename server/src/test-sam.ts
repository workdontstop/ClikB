import { fal } from "@fal-ai/client";

async function testSAM() {
  const imageUrl = "https://hips.hearstapps.com/hmg-prod/images/cute-cat-photos-1593441022.jpg?crop=1.00xw:0.753xh;0,0.153xh&resize=1200:*"; // valid cat image
  const x = 600;
  const y = 400;
  console.log("Calling SAM-3 with box prompt...");
  try {
    const result = await fal.subscribe("fal-ai/sam-3/image", {
      input: {
        image_url: imageUrl,
        prompt: "",
        point_prompts: [{ x: x, y: y, label: 1 as any }],
        box_prompts: [{ x_min: x - 100, y_min: y - 100, x_max: x + 100, y_max: y + 100 }]
      }
    });

    console.log("Response:", JSON.stringify(result.data, null, 2).substring(0, 500));
  } catch (err: any) {
    console.error("Error Detail:", JSON.stringify(err.body?.detail, null, 2));
  }
}

testSAM().catch(console.error);
