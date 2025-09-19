// services/volcengineService.ts

import { ImageStyle, AspectRatio, GeneratedImage } from '../types';

const VOLC_TIMEOUT_MS = 60000; // 增加超时以适配多图/大图场景

// 火山引擎豆包API配置（通过 Vite 代理 '/ark' 以避免浏览器 CORS）
const VOLCENGINE_API_ENDPOINT = '/ark/api/v3/images/generations';
const VOLCENGINE_MODEL = 'doubao-seedream-4-0-250828';

// 备用API地址（如果主地址不可用）
const VOLCENGINE_API_ENDPOINT_BACKUP = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

export interface VolcEngineImageRequest {
  model: string;
  prompt: string;
  size?: string;
  stream?: boolean;
  response_format?: 'url' | 'b64_json';
  watermark?: boolean;
  guidance_scale?: number;
  image?: string | string[];
  mask?: string;
  sequential_image_generation?: 'auto' | 'off';
  sequential_image_generation_options?: {
    max_images?: number;
  };
}

export interface VolcEngineImageResponse {
  created: number;
  data: Array<{
    url: string;
    b64_json?: string;
  }>;
}

// 豆包风格映射
const doubaoStylePrompts = {
  [ImageStyle.ILLUSTRATION]: "现代扁平插画风格，使用简单形状、大胆色彩和清晰线条，避免渐变和复杂纹理，角色和对象应该风格化和极简主义",
  [ImageStyle.CLAY]: "粘土动画风格，所有对象和角色应该看起来像用粘土雕刻的，有可见的纹理和工具痕迹，使用鲜艳饱和的调色板和柔和的立体照明",
  [ImageStyle.DOODLE]: "有趣的涂鸦风格，使用粗大的彩色铅笔笔触，异想天开的角色，剪贴簿感觉，整体氛围友好平易近人",
  [ImageStyle.CARTOON]: "超级可爱的卡通风格，角色有大而有表现力的眼睛，圆滑的身体和简单的特征，使用柔和的粉彩调色板，干净大胆的轮廓",
  [ImageStyle.INK_WASH]: "中国水墨画风格，使用多变的笔触，从精细的线条到宽阔的色块，强调氛围、留白和气韵，调色板主要是单色，偶尔有微妙的色彩点缀",
  [ImageStyle.AMERICAN_COMIC]: "美国漫画风格，使用大胆的动态轮廓，戏剧性的阴影技术如交叉影线和墨点，色彩鲜艳但有印刷纹理，重点是英雄姿势和表现力强的面孔",
  [ImageStyle.WATERCOLOR]: "精致的水彩画风格，使用柔软的混合色块，可见的纸张纹理，边缘柔软有时会相互渗透，整体氛围轻盈、空灵和艺术性",
  [ImageStyle.PHOTOREALISTIC]: "写实照片风格，强调现实的光照、纹理和细节，使图像看起来像高分辨率照片，使用自然的色彩分级和景深",
  [ImageStyle.JAPANESE_MANGA]: "经典黑白日本漫画风格，使用清晰干净的线条，网点纸阴影，表情丰富的角色和大眼睛，侧重动态动作线条和面板美学",
  [ImageStyle.THREE_D_ANIMATION]: "精致的3D动画风格，角色和对象有光滑圆滑的表面，场景有动态照明、阴影和深度感，整体氛围迷人且视觉丰富",
};

// 尺寸映射 - 豆包4.0支持标准分辨率
const aspectRatioToSize = (ratio: AspectRatio): string => {
  switch (ratio) {
    case '1:1':
      return '1024x1024'; // 1,048,576 px
    case '16:9':
      return '1280x720'; // 921,600 px
    case '9:16':
      return '720x1280'; // 921,600 px
    case '4:3':
      return '1152x864'; // 995,328 px
    case '3:4':
      return '864x1152'; // 995,328 px
    default:
      return '1024x1024';
  }
};

const handleVolcEngineApiError = (error: unknown): Error => {
  console.error("Error calling VolcEngine API:", error);
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('invalid api key') || message.includes('unauthorized')) {
      return new Error("您提供的火山引擎API密钥无效或不正确。请检查后重试。");
    }

    if (message.includes('quota') || message.includes('rate limit') || message.includes('resource_exhausted')) {
      return new Error("您的火山引擎API配额已用尽或已达到速率限制。请检查您的配额或稍后再试。");
    }

    if (message.includes('invalid_request') || message.includes('invalid parameter')) {
      return new Error("请求参数无效。请检查您的提示词或设置后重试。");
    }

    if (message.includes('content_filter') || message.includes('safety')) {
      return new Error("生成的内容可能违反了安全政策而被阻止。请尝试调整您的提示词。");
    }

    // 显示原始错误信息以便调试
    return new Error(`火山引擎API错误: ${error.message}`);
  }

  return new Error("火山引擎API调用失败。请稍后重试或检查您的网络连接。");
};

export const generateTextToImageWithVolcEngine = async (
  prompt: string,
  negativePrompt: string,
  apiKey: string,
  aspectRatio: AspectRatio,
  style: ImageStyle
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("火山引擎API密钥是必需的。");
  }

  try {
    // 简化提示词，避免过长
    const stylePrompt = doubaoStylePrompts[style].substring(0, 100); // 限制风格描述长度
    const finalPrompt = `${prompt}，${stylePrompt}`.substring(0, 300); // 限制总长度

    // 简化请求参数，避免过多可选参数导致错误
    const requestBody: any = {
      model: VOLCENGINE_MODEL,
      prompt: finalPrompt,
      size: aspectRatioToSize(aspectRatio),
      stream: false,
      response_format: "b64_json",
      watermark: true,
    };

    // 添加负面提示词（如果有的话）
    if (negativePrompt && negativePrompt.trim()) {
      requestBody.prompt += `，避免：${negativePrompt.trim().substring(0, 50)}`;
    }

    // 调试日志
    console.log('火山引擎请求参数:', JSON.stringify(requestBody, null, 2));
    console.log('火山引擎API地址:', VOLCENGINE_API_ENDPOINT);
    console.log('API密钥长度:', apiKey ? apiKey.length : 0);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VOLC_TIMEOUT_MS);
    const response = await fetch(VOLCENGINE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('火山引擎API错误详情:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        requestUrl: VOLCENGINE_API_ENDPOINT,
        requestBody: requestBody
      });
      throw new Error(`火山引擎API错误: ${response.status} - ${errorText}`);
    }

    const data: VolcEngineImageResponse = await response.json();
    console.log('火山引擎响应数据(简要):', {
      created: (data as any)?.created,
      dataLength: Array.isArray((data as any)?.data) ? (data as any).data.length : 0,
    });

    if (data.data && data.data.length > 0) {
      return data.data.map((item, index) => {
        // 如果返回base64编码的图片
        if (item.b64_json) {
          return `data:image/jpeg;base64,${item.b64_json}`;
        }
        // 如果返回URL
        if (item.url) {
          return item.url;
        }
        throw new Error(`图片${index + 1}没有有效的数据`);
      });
    }

    throw new Error("火山引擎未能生成任何图片。请尝试更换您的提示词。");
  } catch (error) {
    throw handleVolcEngineApiError(error);
  }
};

// 图生图功能
export const generateImageToImageWithVolcEngine = async (
  prompt: string,
  referenceImage: string,
  apiKey: string,
  size: string = "2K",
  guidanceScale: number = 7.5
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("火山引擎API密钥是必需的。");
  }

  if (!referenceImage) {
    throw new Error("参考图是必需的。");
  }

  try {
    const requestBody: VolcEngineImageRequest = {
      model: VOLCENGINE_MODEL,
      prompt: prompt,
      image: referenceImage,
      size: size,
      stream: false,
      response_format: "b64_json",
      watermark: true,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VOLC_TIMEOUT_MS);
    const response = await fetch(VOLCENGINE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`火山引擎API错误: ${response.status} - ${errorText}`);
    }

    const data: VolcEngineImageResponse = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data.map((item, index) => {
        if (item.b64_json) {
          return `data:image/jpeg;base64,${item.b64_json}`;
        }
        if (item.url) {
          return item.url;
        }
        throw new Error(`图片${index + 1}没有有效的数据`);
      });
    }

    throw new Error("火山引擎未能生成任何图片。请尝试更换您的提示词或参考图。");
  } catch (error) {
    throw handleVolcEngineApiError(error);
  }
};

// 多图融合功能
export const generateImageFusionWithVolcEngine = async (
  prompt: string,
  referenceImages: string[],
  apiKey: string,
  size: string = "2K",
  guidanceScale: number = 7.5
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("火山引擎API密钥是必需的。");
  }

  if (!referenceImages || referenceImages.length === 0) {
    throw new Error("参考图列表是必需的。");
  }

  if (referenceImages.length > 15) {
    throw new Error("参考图数量不能超过15张。");
  }

  try {
    const requestBody: VolcEngineImageRequest = {
      model: VOLCENGINE_MODEL,
      prompt: prompt,
      image: referenceImages,
      size: size,
      stream: false,
      response_format: "b64_json",
      watermark: true,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VOLC_TIMEOUT_MS);
    const response = await fetch(VOLCENGINE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`火山引擎API错误: ${response.status} - ${errorText}`);
    }

    const data: VolcEngineImageResponse = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data.map((item, index) => {
        if (item.b64_json) {
          return `data:image/jpeg;base64,${item.b64_json}`;
        }
        if (item.url) {
          return item.url;
        }
        throw new Error(`图片${index + 1}没有有效的数据`);
      });
    }

    throw new Error("火山引擎未能生成任何融合图片。请尝试更换您的提示词或参考图。");
  } catch (error) {
    throw handleVolcEngineApiError(error);
  }
};

// 组图生成功能
export const generateSequentialImagesWithVolcEngine = async (
  prompt: string,
  apiKey: string,
  maxImages: number = 5,
  size: string = "2K",
  guidanceScale: number = 7.5
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("火山引擎API密钥是必需的。");
  }

  if (maxImages < 1 || maxImages > 15) {
    throw new Error("生成图片数量必须在1-15之间。");
  }

  try {
    const requestBody: VolcEngineImageRequest = {
      model: VOLCENGINE_MODEL,
      prompt: prompt,
      size: size,
      sequential_image_generation: "auto",
      sequential_image_generation_options: {
        max_images: maxImages,
      },
      stream: false,
      response_format: "b64_json",
      watermark: true,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VOLC_TIMEOUT_MS);
    const response = await fetch(VOLCENGINE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`火山引擎API错误: ${response.status} - ${errorText}`);
    }

    const data: VolcEngineImageResponse = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data.map((item, index) => {
        if (item.b64_json) {
          return `data:image/jpeg;base64,${item.b64_json}`;
        }
        if (item.url) {
          return item.url;
        }
        throw new Error(`图片${index + 1}没有有效的数据`);
      });
    }

    throw new Error("火山引擎未能生成任何组图。请尝试更换您的提示词。");
  } catch (error) {
    throw handleVolcEngineApiError(error);
  }
};

export const generateIllustratedCardsWithVolcEngine = async (
  prompt: string,
  style: ImageStyle,
  apiKey: string
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("火山引擎API密钥是必需的。");
  }

  try {
    const requestBody: VolcEngineImageRequest = {
      model: VOLCENGINE_MODEL,
      prompt: `16:9宽屏比例的教育信息图，视觉解释概念：${prompt}。艺术风格：${doubaoStylePrompts[style]}。图片必须包含清晰简洁的英文文本来标记关键元素并提供简要说明。不包含中文字符。`,
      size: "1280x720",
      stream: false,
      response_format: "b64_json",
      watermark: true,
    };

    const response = await fetch(VOLCENGINE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`火山引擎API错误: ${response.status} - ${errorText}`);
    }

    const data: VolcEngineImageResponse = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data.map((item, index) => {
        if (item.b64_json) {
          return `data:image/jpeg;base64,${item.b64_json}`;
        }
        if (item.url) {
          return item.url;
        }
        throw new Error(`图片${index + 1}没有有效的数据`);
      });
    }

    throw new Error("火山引擎未能生成任何图解卡片。请尝试更换您的问题或风格。");
  } catch (error) {
    throw handleVolcEngineApiError(error);
  }
};

export const generateComicStripWithVolcEngine = async (
  story: string,
  style: ImageStyle,
  apiKey: string,
  numberOfImages: number
): Promise<{ imageUrls: string[], panelPrompts: string[] }> => {
  if (!apiKey) {
    throw new Error("火山引擎API密钥是必需的。");
  }

  try {
    // 生成每个面板的详细提示词
    const panelPrompts = [
      `${story} - 第1个场景，${doubaoStylePrompts[style]}`,
      `${story} - 第2个场景，${doubaoStylePrompts[style]}`,
      `${story} - 第3个场景，${doubaoStylePrompts[style]}`,
      `${story} - 第4个场景，${doubaoStylePrompts[style]}`,
    ].slice(0, numberOfImages);

    const imagePromises = panelPrompts.map(panelPrompt => {
      const requestBody: VolcEngineImageRequest = {
        model: VOLCENGINE_MODEL,
        prompt: panelPrompt,
        size: "1280x720", // 16:9 比例（921,600 px）
        stream: false,
        response_format: "b64_json",
        watermark: true,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), VOLC_TIMEOUT_MS);
      return fetch(VOLCENGINE_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    });

    const responses = await Promise.all(imagePromises);
    const images: string[] = [];

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`面板${i + 1}生成失败: ${response.status} - ${errorText}`);
      }

      const data: VolcEngineImageResponse = await response.json();

      if (data.data && data.data.length > 0) {
        const item = data.data[0];
        if (item.b64_json) {
          images.push(`data:image/jpeg;base64,${item.b64_json}`);
        } else if (item.url) {
          images.push(item.url);
        } else {
          throw new Error(`面板${i + 1}没有有效的图片数据`);
        }
      } else {
        throw new Error(`面板${i + 1}生成失败`);
      }
    }

    if (images.length > 0) {
      return { imageUrls: images, panelPrompts };
    }

    throw new Error("火山引擎未能生成任何连环画面板。请检查您的故事或尝试其他风格。");
  } catch (error) {
    throw handleVolcEngineApiError(error);
  }
};

// 局部重绘（Inpainting）
export const generateInpaintingWithVolcEngine = async (
  prompt: string,
  originalImageBase64: string,
  maskBase64: string,
  apiKey: string,
  size: string = '1024x1024'
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("火山引擎API密钥是必需的。");
  }

  try {
    const requestBody: VolcEngineImageRequest = {
      model: VOLCENGINE_MODEL,
      prompt,
      image: originalImageBase64,
      mask: maskBase64,
      size,
      stream: false,
      response_format: 'b64_json',
      watermark: true,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VOLC_TIMEOUT_MS);
    const response = await fetch(VOLCENGINE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`火山引擎API错误: ${response.status} - ${errorText}`);
    }

    const data: VolcEngineImageResponse = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data.map(item => item.b64_json ? `data:image/jpeg;base64,${item.b64_json}` : item.url);
    }

    throw new Error("火山引擎未能生成任何图片。请尝试调整您的蒙版或提示词。");
  } catch (error) {
    throw handleVolcEngineApiError(error);
  }
};