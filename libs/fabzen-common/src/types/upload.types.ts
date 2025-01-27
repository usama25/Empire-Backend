export type FormDataField = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'files' | 'file';
  required: boolean;
};
