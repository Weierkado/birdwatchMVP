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
        text: `你听到${species.name}的叫声。`
      };
    }
  }

  return {
    spotId: spot.id,
    spotName: spot.name,
    heardSpeciesId: null,
    heardSpeciesName: null,
    text: "没有明显鸟鸣。"
  };
}

function formatDistantListenResult(distantClues) {
  const distantLines = distantClues.length > 0
    ? distantClues.map((clue) => `${clue.spotName}：${clue.text}`).join("\n")
    : "远处暂时没有可分辨的相邻鸟点声音。";

  return `你停下脚步，分辨远处传来的鸟鸣。\n\n${distantLines}`;
}

export function observeCurrentDirection(state) {
  const birds = getBirdsInCurrentDirection(state);
  const bird = pickFirstBird(birds);

  if (!bird) {
    return {
      found: false,
      message: "你仔细观察当前方向，但只看到枝叶和草影。"
    };
  }

  bird.clueStrength += 1;
  const discoverChance = 0.45 + bird.clueStrength * 0.2;

  if (Math.random() < discoverChance) {
    const species = getSpeciesById(bird.speciesId);
    return {
      found: true,
      bird,
      message: `你顺着线索看去，发现了${species.name}。`
    };
  }

  return {
    found: false,
    message: "你感觉鸟就在附近，但这次还没有看清。"
  };
}

export function listen(state) {
  const birds = getBirdsInCurrentDirection(state);
  const bird = pickFirstBird(birds);

  if (!bird) {
    return {
      heardSpeciesId: null,
      message: "你静听片刻，只听见远处的风声。"
    };
  }

  bird.clueStrength += 2;
  const species = getSpeciesById(bird.speciesId);

  return {
    heardSpeciesId: bird.speciesId,
    message: `你听见${species.name}的声音，方向感更明确了。`
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
