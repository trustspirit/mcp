export interface ModelInfo {
  name: string;
  description: string;
}

export interface OpenAIModels {
  gpt: ModelInfo[];
  coding: ModelInfo[];
  research: ModelInfo[];
  image: ModelInfo[];
  video: ModelInfo[];
  audio: ModelInfo[];
  etc: ModelInfo[];
}

export const OPENAI_MODELS: OpenAIModels = {
  // GPT 계열 (텍스트 생성)
  gpt: [
    // GPT-5 계열
    {
      name: "gpt-5.1",
      description: "최신 GPT-5.1 모델: 코딩·에이전트 작업에 최적화",
    },
    { name: "gpt-5", description: "이전 세대 GPT-5 모델" },
    { name: "gpt-5-pro", description: "향상된 GPT-5 버전" },
    { name: "gpt-5-mini", description: "빠르고 비용 효율적인 GPT-5 mini" },
    { name: "gpt-5-nano", description: "가장 빠르고 저렴한 GPT-5 nano" },
    // GPT-4.1 계열
    {
      name: "gpt-4.1",
      description: "도구 호출과 지침 따르기 특화된 GPT-4.1 모델",
    },
    { name: "gpt-4.1-mini", description: "GPT-4.1의 축소판" },
    { name: "gpt-4.1-nano", description: "GPT-4.1의 nano 버전" },
    { name: "gpt-4-turbo", description: "이전 세대 GPT-4 Turbo" },
    { name: "gpt-3.5-turbo", description: "GPT-3.5 터보 (레거시) 모델" },
    { name: "davinci-002", description: "GPT-3 기반의 이전 세대 모델" },
  ],

  // Codex (코딩 전용)
  coding: [
    { name: "gpt-5.1-codex", description: "GPT-5.1 기반 코딩 모델" },
    {
      name: "gpt-5.1-codex-max",
      description: "긴 코딩 작업에 최적화된 최고성능 Codex",
    },
    { name: "gpt-5-codex", description: "GPT-5 기반 코딩 모델" },
    { name: "gpt-5.1-codex-mini", description: "비용을 줄인 Codex mini" },
  ],

  // o-시리즈 및 연구 모델
  research: [
    { name: "o3", description: "초기 o-시리즈 추론 모델" },
    { name: "o3-mini", description: "o3의 소형 버전" },
    { name: "o3-pro", description: "더 많은 컴퓨팅 리소스로 향상된 o3" },
    { name: "o4-mini", description: "빠르고 저렴한 o4 계열 모델" },
    { name: "o3-deep-research", description: "심층 연구용 모델" },
    { name: "o4-mini-deep-research", description: "심층 연구용 소형 모델" },
    { name: "o1", description: "초기 o-시리즈 모델" },
    { name: "o1-pro", description: "향상된 o1 버전" },
    { name: "o1-mini", description: "축소판 o1 (일부는 미리보기)" },
  ],

  // 이미지 생성/편집
  image: [
    {
      name: "gpt-image-1",
      description: "이미지 생성과 편집을 지원하는 GPT Image 1",
    },
    { name: "gpt-image-1-mini", description: "GPT Image 1의 소형 모델" },
    { name: "dall-e-3", description: "더 이상 권장되지 않는 DALL·E 3" },
  ],

  // 비디오 생성
  video: [
    {
      name: "sora-2",
      description: "동기화된 오디오와 함께 비디오를 생성하는 모델",
    },
    { name: "sora-2-pro", description: "Sora 2의 고급형" },
  ],

  // 오디오/리얼타임
  audio: [
    { name: "gpt-realtime", description: "텍스트·오디오 리얼타임 처리 모델" },
    { name: "gpt-realtime-mini", description: "리얼타임 모델의 소형 버전" },
    { name: "gpt-audio", description: "오디오 입력·출력을 지원하는 모델" },
    { name: "gpt-audio-mini", description: "오디오 모델의 축소판" },
    { name: "gpt-4o-audio", description: "GPT-4o 기반 오디오 모델" },
    {
      name: "gpt-4o-mini-audio",
      description: "GPT-4o 오디오 모델의 소형 버전",
    },
    { name: "gpt-4o-realtime", description: "GPT-4o 기반 리얼타임 모델" },
    { name: "gpt-4o-mini-realtime", description: "GPT-4o 리얼타임의 축소판" },
  ],

  // 기타 특수 모델
  etc: [
    {
      name: "computer-use-preview",
      description: "컴퓨터 도구 사용을 위한 미리보기 모델",
    },
    {
      name: "gpt-4o-search-preview",
      description: "웹 검색에 최적화된 GPT-4o 프리뷰",
    },
    {
      name: "gpt-4o-mini-search-preview",
      description: "GPT-4o 검색 프리뷰의 소형 모델",
    },
    {
      name: "omni-moderation",
      description: "텍스트·이미지의 해로운 콘텐츠 식별 모델",
    },
    {
      name: "gpt-oss-120b",
      description: "Apache 2.0 라이선스의 오픈 가중치 모델 (대형)",
    },
    {
      name: "gpt-oss-20b",
      description: "Apache 2.0 라이선스의 오픈 가중치 모델 (중형)",
    },
  ],
};

// 모든 모델을 flat 배열로 가져오기
export const getAllModels = (): ModelInfo[] => {
  return [
    ...OPENAI_MODELS.gpt,
    ...OPENAI_MODELS.coding,
    ...OPENAI_MODELS.research,
    ...OPENAI_MODELS.image,
    ...OPENAI_MODELS.video,
    ...OPENAI_MODELS.audio,
    ...OPENAI_MODELS.etc,
  ];
};

// 카테고리별 모델 가져오기
export const getModelsByCategory = (
  category: keyof OpenAIModels
): ModelInfo[] => {
  return OPENAI_MODELS[category];
};

// 모델 이름으로 검색
export const findModelByName = (name: string): ModelInfo | undefined => {
  return getAllModels().find(
    (model) => model.name.toLowerCase() === name.toLowerCase()
  );
};

// 카테고리 목록
export const MODEL_CATEGORIES = [
  "gpt",
  "coding",
  "research",
  "image",
  "video",
  "audio",
  "etc",
] as const;

export type ModelCategory = (typeof MODEL_CATEGORIES)[number];
