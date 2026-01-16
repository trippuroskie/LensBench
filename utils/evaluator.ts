
/**
 * Simple JSON similarity score based on field matching.
 */
export function calculateAccuracy(actualStr: string, expectedStr: string): number {
  try {
    const actualObj = JSON.parse(actualStr);
    const expectedObj = JSON.parse(expectedStr);
    
    const expectedKeys = getFlatKeys(expectedObj);
    if (expectedKeys.length === 0) return 0;
    
    let matches = 0;
    expectedKeys.forEach(key => {
      let actualRaw = findValueRecursively(actualObj, key);
      const expectedVal = getValueByPath(expectedObj, key);
      
      // Handle the new nested structure: { value, confidence }
      let actualVal = actualRaw;
      if (actualRaw && typeof actualRaw === 'object' && 'value' in actualRaw) {
        actualVal = actualRaw.value;
      }
      
      // Basic fuzzy equality for numbers/strings
      if (actualVal !== undefined && actualVal !== null && 
          String(actualVal).toLowerCase().trim() === String(expectedVal).toLowerCase().trim()) {
        matches++;
      }
    });
    
    return matches / expectedKeys.length;
  } catch (e) {
    console.error("Accuracy calc error:", e);
    return 0;
  }
}

/**
 * Attempts to find a value in an object using a dot-path, 
 * but falls back to searching for the leaf key if the full path is missing.
 */
export function findValueRecursively(obj: any, fullPath: string): any {
  // 1. Try exact path match
  const directMatch = getValueByPath(obj, fullPath);
  if (directMatch !== undefined) return directMatch;

  // 2. Try matching the leaf key anywhere in the object if path fails
  const parts = fullPath.split('.');
  const leafKey = parts[parts.length - 1];
  
  return findKeyInObject(obj, leafKey);
}

function findKeyInObject(obj: any, targetKey: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  
  if (targetKey in obj) return obj[targetKey];
  
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      const found = findKeyInObject(obj[key], targetKey);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function getFlatKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  if (!obj || typeof obj !== 'object') return keys;

  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (Array.isArray(value)) {
      value.forEach((item: any, index: number) => {
        if (typeof item === 'object' && item !== null) {
          keys = keys.concat(getFlatKeys(item, `${path}[${index}]`));
        } else {
          keys.push(`${path}[${index}]`);
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      // Don't treat {value, confidence} as a nesting layer for key comparison
      if ('value' in value && 'confidence' in value) {
        keys.push(path);
      } else {
        keys = keys.concat(getFlatKeys(value, path));
      }
    } else {
      keys.push(path);
    }
  }
  return keys;
}

export function getValueByPath(obj: any, path: string): any {
  if (!obj) return undefined;
  return path.split(/[.\[\]]+/).filter(Boolean).reduce((acc, part) => acc?.[part], obj);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
