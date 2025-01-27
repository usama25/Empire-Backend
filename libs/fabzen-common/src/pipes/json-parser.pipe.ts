import { PipeTransform, Injectable } from '@nestjs/common';

@Injectable()
export class JSONParserPipe implements PipeTransform {
  transform(value: any) {
    try {
      value = JSON.parse(value);
    } catch {}
    return value;
  }
}
