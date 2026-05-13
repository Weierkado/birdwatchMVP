import { DIRECTIONS, MAX_PHOTOS, MAX_TURNS } from "../data/config.js";
import { loadFieldGuide } from "./storage.js";

export function createDefaultGameState() {
  return {
    mode: "START",
    currentTurn: 0,
    maxTurns: MAX_TURNS,
    currentSpotId: "garden_edge",
    availableSpotOptions: [],
    facingDirection: 0,
    directions: DIRECTIONS,
    maxPhotos: MAX_PHOTOS,
    photos: [],
    logs: ["翻开观察笔记，准备开始今天的观鸟。"],
    activeBirds: [],
    currentPhotoTarget: null,
    currentPhotoSequence: null,
    distantListenOptions: [],
    fieldGuide: loadFieldGuide(),
    sessionNewCards: [],
    sessionHeardSpeciesIds: [],
    unlockedCardIdsAtRunStart: [],
    eventText: "点击开始游戏，进入一局 30 回合的文字观鸟。",
    eventHtml: ""
  };
}
