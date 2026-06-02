import { DISTANT_LISTEN_CONFIG } from "../data/config.js";
import { getBirdsInCurrentDirection, getSpeciesById } from "./birdManager.js";
import { getNeighborSpots, pickWeightedSpecies } from "./spotManager.js";

function pickFirstBird(birds) {
  return birds[0] || null;
}

function shouldHear(chance) {
  return Math.random() < chance;
}

function getSpeciesFromWeights(speciesWeights) {
  if (!speciesWeights) {
    return null;
  }

  return pickWeightedSpecies(speciesWeights);
}

function getDistantSoundClue(spot) {
  if (shouldHear(DISTANT_LISTEN_CONFIG.hearChance)) {
    const species = getSpeciesFromWeights(spot.speciesWeights);

    if (species) {
      return {
        spotId: spot.id,
        spotName: spot.name,
        heardSpeciesId: species.id,
        heardSpeciesName: species.name,
        text: "前方传来鸟声。"
      };
    }
  }

  return {
    spotId: spot.id,
    spotName: spot.name,
    heardSpeciesId: null,
    heardSpeciesName: null,
    text: "没有听到清楚的鸟鸣。"
  };
}

function formatDistantListenResult(distantClues) {
  const distantLines = distantClues.length > 0
    ? distantClues.map((clue) => `${clue.spotName}：${clue.text}`).join("\n")
    : "远处的声音太散了，暂时分不出来自哪里。";

  return `停下来，分辨远处混在一起的鸟鸣。\n\n${distantLines}`;
}

export function observeCurrentDirection(state) {
  const birds = getBirdsInCurrentDirection(state);
  const bird = pickFirstBird(birds);

  if (!bird) {
    return {
      found: false,
      message: "顺着当前方向看过去，只看到枝叶和草影。"
    };
  }

  bird.clueStrength += 1;
  const discoverChance = 0.45 + bird.clueStrength * 0.2;

  if (Math.random() < discoverChance) {
    const species = getSpeciesById(bird.speciesId);
    return {
      found: true,
      bird,
      message: "顺着线索看去，发现了前方的鸟影。"
    };
  }

  return {
    found: false,
    message: "枝叶晃了一下，但还没看清是什么。"
  };
}

export function listen(state) {
  const birds = getBirdsInCurrentDirection(state);
  const bird = pickFirstBird(birds);

  if (!bird) {
    return {
      heardSpeciesId: null,
      message: "静听片刻，只听见远处的风声。"
    };
  }

  bird.clueStrength += 2;
  const species = getSpeciesById(bird.speciesId);
  return {
    heardSpeciesId: bird.speciesId,
    message: "前方有鸟声，方向感更明确了。"
  };
}

export function listenDistantSounds(state) {
  const distantClues = getNeighborSpots(
    state.currentSpotId,
    DISTANT_LISTEN_CONFIG.neighborLimit
  ).map(getDistantSoundClue);
  const heardSpeciesIds = distantClues
    .map((clue) => clue.heardSpeciesId)
    .filter(Boolean);

  return {
    heardSpeciesIds,
    distantClues,
    message: formatDistantListenResult(distantClues)
  };
}
