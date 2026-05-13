import { spotList } from "../data/spots.js";
import { speciesList } from "../data/species.js";

export function getAllSpots() {
  return spotList;
}

export function getSpotById(spotId) {
  return spotList.find((spot) => spot.id === spotId) || spotList[0];
}

export function getCurrentSpot(state) {
  return getSpotById(state.currentSpotId);
}

export function getAvailableSpotOptions(currentSpotId) {
  const otherSpots = spotList.filter((spot) => spot.id !== currentSpotId);
  const shuffledSpots = [...otherSpots].sort(() => Math.random() - 0.5);
  return shuffledSpots.slice(0, 3);
}

export function getNeighborSpots(currentSpotId, limit = 2) {
  const currentSpot = getSpotById(currentSpotId);
  const neighborIds = currentSpot.neighbors || [];

  return neighborIds
    .map((spotId) => spotList.find((spot) => spot.id === spotId))
    .filter(Boolean)
    .slice(0, limit);
}

function getSpotDirectionName(spot, directionIndex) {
  return spot.directions[directionIndex] || "未记录的观察面";
}

export function getSurroundingSpotMap(state) {
  const currentSpot = getCurrentSpot(state);
  const facingDirection = state.facingDirection % 4;

  return {
    currentSpot,
    facingName: getSpotDirectionName(currentSpot, facingDirection),
    front: getSpotDirectionName(currentSpot, facingDirection),
    right: getSpotDirectionName(currentSpot, (facingDirection + 1) % 4),
    back: getSpotDirectionName(currentSpot, (facingDirection + 2) % 4),
    left: getSpotDirectionName(currentSpot, (facingDirection + 3) % 4)
  };
}

export function pickWeightedSpecies(speciesWeights) {
  const weightedEntries = Object.entries(speciesWeights).filter((entry) => entry[1] > 0);
  const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry[1], 0);
  let roll = Math.random() * totalWeight;

  for (const [speciesId, weight] of weightedEntries) {
    roll -= weight;
    if (roll <= 0) {
      return speciesList.find((species) => species.id === speciesId) || speciesList[0];
    }
  }

  return speciesList[0];
}
