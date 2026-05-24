import { BIRD_DISTANCE_DEFAULT_WEIGHTS, BIRD_STAY_TURNS, DIRECTIONS, INITIAL_ACTIVE_BIRDS } from "../data/config.js";
import { speciesList } from "../data/species.js";
import { getCurrentSpot, pickWeightedSpecies } from "./spotManager.js";

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSafeDistanceWeights(weights) {
  const allowedDistances = ["near", "medium", "far"];
  const safeWeights = {};
  let totalWeight = 0;
  let hasInvalidWeight = false;

  allowedDistances.forEach((distance) => {
    if (!weights || !Object.prototype.hasOwnProperty.call(weights, distance)) {
      hasInvalidWeight = true;
      return;
    }

    const weight = Number(weights[distance]);
    if (!Number.isFinite(weight) || weight < 0) {
      hasInvalidWeight = true;
      return;
    }

    safeWeights[distance] = weight;
    totalWeight += safeWeights[distance];
  });

  return !hasInvalidWeight && totalWeight > 0 ? safeWeights : BIRD_DISTANCE_DEFAULT_WEIGHTS;
}

function pickWeightedDistance(species) {
  const weights = getSafeDistanceWeights(species && species.distanceDistribution);
  const totalWeight = weights.near + weights.medium + weights.far;
  let roll = Math.random() * totalWeight;

  if (roll < weights.near) {
    return "near";
  }

  roll -= weights.near;
  if (roll < weights.medium) {
    return "medium";
  }

  return "far";
}

function createBirdInstance(species, idNumber) {
  return {
    instanceId: `${species.id}_${Date.now()}_${idNumber}`,
    speciesId: species.id,
    distance: pickWeightedDistance(species),
    directionIndex: randomNumber(0, DIRECTIONS.length - 1),
    stayTurns: randomNumber(BIRD_STAY_TURNS.min, BIRD_STAY_TURNS.max),
    clueStrength: 0
  };
}

function pickRandomSpecies(currentSpot) {
  if (currentSpot && currentSpot.speciesWeights) {
    return pickWeightedSpecies(currentSpot.speciesWeights);
  }

  const index = randomNumber(0, speciesList.length - 1);
  return speciesList[index];
}

export function initializeBirds(currentSpot) {
  const birds = [];

  for (let index = 0; index < INITIAL_ACTIVE_BIRDS; index += 1) {
    birds.push(createBirdInstance(pickRandomSpecies(currentSpot), index));
  }

  return birds;
}

export function updateBirds(state) {
  const currentSpot = getCurrentSpot(state);
  const updatedBirds = state.activeBirds
    .map((bird) => ({
      ...bird,
      stayTurns: bird.stayTurns - 1
    }))
    .filter((bird) => bird.stayTurns > 0);

  while (updatedBirds.length < INITIAL_ACTIVE_BIRDS) {
    updatedBirds.push(createBirdInstance(pickRandomSpecies(currentSpot), updatedBirds.length));
  }

  return updatedBirds;
}

export function getBirdsInCurrentDirection(state) {
  return state.activeBirds.filter((bird) => bird.directionIndex === state.facingDirection);
}

export function generateClues(state) {
  const birds = getBirdsInCurrentDirection(state);

  if (birds.length === 0) {
    return "这个方向暂时没有清楚的鸟影。";
  }

  const clues = birds
    .map((bird) => {
      const species = speciesList.find((item) => item.id === bird.speciesId);
      return species ? species.clue : "枝叶里有轻微动静，但还看不清是什么。";
    })
    .filter(Boolean);
  const uniqueClues = [...new Set(clues)];

  return uniqueClues.join(" ");
}

export function getSpeciesById(speciesId) {
  return speciesList.find((species) => species.id === speciesId);
}
