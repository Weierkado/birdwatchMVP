import { getBirdsInCurrentDirection, getSpeciesById } from "./birdManager.js";

function pickFirstBird(birds) {
  return birds[0] || null;
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
