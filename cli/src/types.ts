export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  severity: Severity;
  file: string;
  path?: string;
  message: string;
}

export interface ValidationResult {
  dir: string;
  issues: ValidationIssue[];
  /** Files present in the directory that are known SDL files */
  foundFiles: string[];
  /** Known SDL filenames that were expected but not found */
  missingFiles: string[];
}
