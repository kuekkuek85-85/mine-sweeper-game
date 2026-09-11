import { describe, expect, it } from 'vitest';

import {
  describeStudentId,
  formatRecord,
  formatSeconds,
  isValidName,
  isValidStudentId,
  maskName,
  parseStudentId,
} from './format';

describe('시간 표시', () => {
  it('0.1초 단위로 내림해서 보여 준다', () => {
    expect(formatSeconds(0)).toBe('0.0');
    expect(formatSeconds(1234)).toBe('1.2');
    expect(formatSeconds(1299)).toBe('1.2');
  });

  it('1분이 넘으면 분:초 형식', () => {
    expect(formatRecord(12_340)).toBe('12.3초');
    expect(formatRecord(62_300)).toBe('1:02.3');
    expect(formatRecord(null)).toBe('-');
  });
});

describe('학번 규칙', () => {
  it('5자리이고 1로 시작해야 한다', () => {
    expect(isValidStudentId('10101')).toBe(true);
    expect(isValidStudentId('20101')).toBe(false);
    expect(isValidStudentId('1010')).toBe(false);
    expect(isValidStudentId('1010a')).toBe(false);
  });

  it('학년·반·번호를 뽑아낸다', () => {
    expect(parseStudentId('10101')).toEqual({ grade: 1, classNo: 1, number: 1 });
    expect(parseStudentId('11223')).toEqual({ grade: 1, classNo: 12, number: 23 });
    expect(parseStudentId('99999')).toBeNull();
  });

  it('확인 문구를 만든다', () => {
    expect(describeStudentId('10101', '이승엽')).toBe('1학년 1반 1번 이승엽');
  });
});

describe('이름 규칙', () => {
  it('한글 2~5자만 허용한다', () => {
    expect(isValidName('이승엽')).toBe(true);
    expect(isValidName('김')).toBe(false);
    expect(isValidName('Lee')).toBe(false);
    expect(isValidName('가나다라마바')).toBe(false);
  });
});

describe('이름 마스킹', () => {
  it('가운데 글자를 가린다', () => {
    expect(maskName('이승엽')).toBe('이○엽');
    expect(maskName('김철')).toBe('김○');
    expect(maskName('남궁민수')).toBe('남○○수');
  });
});
