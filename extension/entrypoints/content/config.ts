export const contentScriptDefinition = {
  matches: [
    'https://boards.greenhouse.io/*',
    'https://job-boards.greenhouse.io/*',
    'https://jobs.lever.co/*',
  ],
  allFrames: true,
};
