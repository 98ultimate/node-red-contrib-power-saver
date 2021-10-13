/**
 * Get today and tomorrow data out of the input message.
 * Can accept 3 types of messages: Tibber, Nordpool or plain payload with data already converted.
 * @param {*} msg
 */
function convertMsg(msg) {
  let today = [];
  let tomorrow = [];
  let source = "Unknown";

  if (msg.payload?.viewer?.homes[0]?.currentSubscription?.priceInfo?.today) {
    source = "Tibber";
    today = msg.payload.viewer.homes[0].currentSubscription.priceInfo.today.map(
      (v) => ({ value: v.total, start: v.startsAt })
    );
  } else if (msg.data?.new_state?.attributes?.raw_today) {
    source = "Nordpool";
    today = msg.data.new_state.attributes.raw_today.map((v) => ({
      value: v.value,
      start: v.start,
    }));
  } else {
    source = "Other";
    today = msg.payload?.today || [];
  }

  if (msg.payload?.viewer?.homes[0]?.currentSubscription?.priceInfo?.tomorrow) {
    tomorrow =
      msg.payload.viewer.homes[0].currentSubscription.priceInfo.tomorrow.map(
        (v) => ({ value: v.total, start: v.startsAt })
      );
  } else if (msg.data?.new_state?.attributes?.raw_tomorrow) {
    tomorrow = msg.data.new_state.attributes.raw_tomorrow.map((v) => ({
      value: v.value,
      start: v.start,
    }));
  } else {
    tomorrow = msg.payload?.tomorrow || [];
  }

  return { today, tomorrow, source };
}

/**
 * Sort values in array and return array with index of original array
 * in sorted order. Highest value first.
 */
function sortedIndex(valueArr) {
  const mapped = valueArr.map((v, i) => {
    return { i, value: v };
  });
  const sorted = mapped.sort((a, b) => {
    if (a.value > b.value) {
      return -1;
    }
    if (a.value < b.value) {
      return 1;
    }
    return 0;
  });
  return sorted.map((p) => p.i);
}

/**
 * Receive an array with values, and another array (same size) with
 * true (on) and false (off) values.
 * Returns an array with the difference between the current value
 * and the next value that is on.
 * If there is no next value that is on, the nextOn value is used.
 * Positive difference is when the current value is higher than the next on.
 *
 * @param {*} values Array of prices
 * @param {*} onOff Array of booleans, where true means on, false means off
 * @param {*} nextOn Value for the next hour on after the whole values array,
 *                   to use for the last hours.
 * @returns Array with diff to next hour that is on. May be negative.
 *
 */
function getDiffToNextOn(values, onOff, nextOn = null) {
  const nextOnValue = nextOn ?? values[values.length - 1];
  const res = values.map((p, i, a) => {
    for (let n = i + 1; n < a.length; n++) {
      if (onOff[n]) {
        return Math.round((values[i] - values[n]) * 10000) / 10000;
      }
    }
    return Math.round((p - nextOnValue) * 10000) / 10000;
  });
  return res;
}

/**
 *
 * @param {*} values Array of prices
 * @param {*} onOff Array of booleans, where true means on, false means off
 * @param {*} nextOn Value for the next hour on after the whole values array,
 *                   to use for the last hours.
 * @returns Array with how much you save on the off-hours, null on the others.
 */
function getSavings(values, onOff, nextOn = null) {
  return getDiffToNextOn(values, onOff, nextOn).map((v, i) =>
    onOff[i] ? null : v
  );
}

/**
 * Takes an array of values and an array of true/valse values (same size).
 * Returns the value from the first array
 * corresponding to the first true value in the second array.
 * If there is none, the defaultValue is returned.
 */
function firstOn(values, onOff, defaultValue = 0) {
  return [...values, defaultValue][[...onOff, true].findIndex((e) => e)];
}

/**
 * Takes an array of true/false values where true means on and false means off.
 * Evaluates of the on/off sequences are valid according to other arguments.
 *
 * @param {*} onOff Array of on/off values
 * @param {*} maxOff Max number of values that can be off in a sequence
 * @param {*} minOnAfterOff Min number of values that must be on after maxOff is reached
 * @returns
 */
function isOnOffSequencesOk(onOff, maxOff, minOnAfterOff) {
  let offCount = 0;
  let onCount = 0;
  let reachedMaxOff = false;
  for (let i = 0; i < onOff.length; i++) {
    if (!onOff[i]) {
      if (maxOff === 0 || reachedMaxOff) {
        return false;
      }
      offCount++;
      onCount = 0;
      if (offCount >= maxOff) {
        reachedMaxOff = true;
      }
    } else {
      if (reachedMaxOff) {
        onCount++;
        if (onCount >= minOnAfterOff) {
          reachedMaxOff = false;
        }
      }
      offCount = 0;
    }
  }
  return true;
}

/**
 * Count number of the given value at the end of the given array
 * @param {*} arr
 * @param {*} value
 */
function countAtEnd(arr, value) {
  let res = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] === value) {
      res++;
    } else {
      break;
    }
  }
  return res;
}

/**
 * Return an array with an item for each time the value shall change.
 * @param {*} onOff Array with on (true) and off (false) values.
 * @param {*} startTimes Array with start time for each onOff value.
 * @param {*} initial Optional. The initial value, to avoid the initial switch.
 * @returns Array with tuples: time and value
 */
function makeSchedule(onOff, startTimes, initial = null) {
  const res = [];
  let prev = initial;
  for (let i = 0; i < startTimes.length; i++) {
    const value = onOff[i];
    if (value !== prev) {
      const time = startTimes[i];
      res.push({ time, value });
      prev = value;
    }
  }
  return res;
}

function fillArray(value, count) {
  if (value === undefined || count <= 0) {
    return [];
  }
  res = [];
  for (let i = 0; i < count; i++) {
    res.push(value);
  }
  return res;
}

module.exports = {
  sortedIndex,
  getDiffToNextOn,
  firstOn,
  isOnOffSequencesOk,
  getSavings,
  countAtEnd,
  makeSchedule,
  fillArray,
  convertMsg,
};