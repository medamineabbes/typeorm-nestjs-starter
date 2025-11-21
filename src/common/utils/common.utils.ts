import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { v4 as uuidV4 } from 'uuid';

export function walkFolder(
  dir: string,
  filesList: string[],
  extension?: string,
) {
  const files = readdirSync(dir);
  filesList = filesList || [];
  files.forEach(function (file) {
    if (statSync(join(dir, file)).isDirectory()) {
      filesList = walkFolder(join(dir, file), filesList, extension);
    } else {
      if (extension) {
        if (file.split('.').pop() === extension) {
          filesList.push(join(dir, file));
        }
      } else {
        filesList.push(join(dir, file));
      }
    }
  });
  return filesList;
}

export const createUniqueID = () => uuidV4().split('-')[0];
