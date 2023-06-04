import { createInterface } from 'readline';

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * wait for CLI input until the specified timeout is reached
 * @param message message to display in the console
 * @param timeout timeout in seconds to wait for
 */
export async function waitForInput(message: string, timeout: number) {
  return new Promise((resolve, reject) => {
    const ac = new AbortController();
    readline.question(message, (name) => {
      readline.close();
      resolve(name);
    });
    setTimeout(() => {
      ac.abort();
      reject(`Timeout of ${timeout} seconds exceeded\n`);
    }, timeout * 1000);
  });
}

/**
 * convert array to map based on the 'name' key of objects in array
 * @param array any array of objects with name property
 */
export function convertArrayToMap(array: any[]) {
  // eslint-disable-next-line prefer-const
  let map: unknown = {};
  for (const item of array) {
    const { name, ...rest } = item;
    map[name] = rest;
  }
  return map;
}
