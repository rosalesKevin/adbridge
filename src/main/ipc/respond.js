'use strict';

/** Wraps an IPC handler so every reply is { success: true, data } or { success: false, error }. */
const respond = (fn) => async (...args) => {
  try {
    return { success: true, data: await fn(...args) };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

module.exports = { respond };
