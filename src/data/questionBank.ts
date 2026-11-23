import { buildQuestionIndex, parseQuestionBank } from '@/utils/questionBank';
import rawBank from './questions.json';

/**
 * Bank soal yang sudah divalidasi. Jika questions.json rusak, aplikasi gagal sejak dimuat
 * (dan unit test gagal sebelum itu), bukan di tengah permainan.
 */
export const QUESTION_BANK = parseQuestionBank(rawBank);

export const QUESTION_INDEX = buildQuestionIndex(QUESTION_BANK);
