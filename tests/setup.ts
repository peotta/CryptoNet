// Sob carga (muitos arquivos de teste em paralelo), a primeira importação preguiçosa de um laboratório pode passar
// de 1 s, o limite padrão das consultas assíncronas (findBy*). Este limite maior evita falhas intermitentes.
import { configure } from '@testing-library/dom';

configure({ asyncUtilTimeout: 8000 });
