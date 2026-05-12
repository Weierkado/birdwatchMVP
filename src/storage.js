const STORAGE_KEY = "birdwatch_text_sim_field_guide";

export function loadFieldGuide() {
  const savedText = localStorage.getItem(STORAGE_KEY);

  if (!savedText) {
    return {
      heardSpeciesIds: [],
      collectedCards: []
    };
  }

  try {
    return JSON.parse(savedText);
  } catch (error) {
    console.warn("图鉴存档读取失败，将使用空图鉴。", error);
    return {
      heardSpeciesIds: [],
      collectedCards: []
    };
  }
}

export function saveFieldGuide(fieldGuide) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fieldGuide));
}

export function clearFieldGuide() {
  localStorage.removeItem(STORAGE_KEY);
}
