import { canonicalSources, heapSource, shortestPathSource } from './editorial-sources.ts';
import { sqlReferenceQueries } from './sql.ts';

const maxSolutions: Record<string, { path: string; content: string }> = {
  typescript: { path: 'solution.ts', content: 'export function findMax(values: readonly number[]): number | null {\n  if (!values.length) return null;\n  let best = values[0];\n  for (let i = 1; i < values.length; i++) if (values[i] > best) best = values[i];\n  return best;\n}\n' },
  javascript: { path: 'solution.js', content: 'export function findMax(values) {\n  if (!values.length) return null;\n  let best = values[0];\n  for (let i = 1; i < values.length; i++) if (values[i] > best) best = values[i];\n  return best;\n}\n' },
  python: { path: 'solution.py', content: 'def find_max(values: list[int]) -> int | None:\n    if not values:\n        return None\n    best = values[0]\n    for index in range(1, len(values)):\n        if values[index] > best:\n            best = values[index]\n    return best\n' },
  java: { path: 'Solution.java', content: 'public final class Solution {\n    public static Integer findMax(int[] values) {\n        if (values.length == 0) return null;\n        int best = values[0];\n        for (int i = 1; i < values.length; i++) if (values[i] > best) best = values[i];\n        return best;\n    }\n}\n' },
  csharp: { path: 'Solution.cs', content: 'public static class Solution {\n    public static int? FindMax(int[] values) {\n        if (values.Length == 0) return null;\n        int best = values[0];\n        for (int i = 1; i < values.Length; i++) if (values[i] > best) best = values[i];\n        return best;\n    }\n}\n' },
  cpp: { path: 'solution.cpp', content: '#include <optional>\n#include <vector>\n\nstd::optional<int> find_max(const std::vector<int>& values) {\n    if (values.empty()) return std::nullopt;\n    int best = values[0];\n    for (std::size_t i = 1; i < values.size(); ++i) if (values[i] > best) best = values[i];\n    return best;\n}\n' },
  c: { path: 'solution.c', content: '#include <stdbool.h>\n#include <stddef.h>\n\ntypedef struct { bool present; int value; } MaxResult;\nMaxResult find_max(const int *values, size_t length) {\n    if (length == 0) return (MaxResult){false, 0};\n    int best = values[0];\n    for (size_t i = 1; i < length; ++i) if (values[i] > best) best = values[i];\n    return (MaxResult){true, best};\n}\n' },
  go: { path: 'solution.go', content: 'package solution\n\nfunc FindMax(values []int) (int, bool) {\n    if len(values) == 0 { return 0, false }\n    best := values[0]\n    for i := 1; i < len(values); i++ { if values[i] > best { best = values[i] } }\n    return best, true\n}\n' },
  rust: { path: 'solution.rs', content: 'pub fn find_max(values: &[i32]) -> Option<i32> {\n    let mut best = *values.first()?;\n    for &value in &values[1..] { if value > best { best = value; } }\n    Some(best)\n}\n' },
  kotlin: { path: 'Solution.kt', content: 'fun findMax(values: IntArray): Int? {\n    if (values.isEmpty()) return null\n    var best = values[0]\n    for (i in 1 until values.size) if (values[i] > best) best = values[i]\n    return best\n}\n' },
};

const hints: Record<string, string[]> = {
  'find-max': ['A maior pontuação pode ser negativa.', 'Guarde o maior valor encontrado enquanto percorre a lista.', 'Comece pelo primeiro elemento e compare os seguintes.'],
  'sum-even': ['Um inteiro é par quando seu resto na divisão por 2 é zero.', 'Mantenha um acumulador iniciado em zero.', 'Some um valor somente se ele atender à condição de paridade.'],
  'count-vowels': ['Maiúsculas e minúsculas contam da mesma forma.', 'Percorra a string e teste a presença do caractere no conjunto de cinco vogais.', 'Incremente o contador uma vez por ocorrência.'],
  'is-palindrome': ['Compare caracteres válidos nas duas extremidades.', 'Mova os dois índices para dentro, ignorando pontuação.', 'Uma diferença entre as letras normalizadas permite retornar false imediatamente.'],
  fizzbuzz: ['A condição de múltiplo de 15 precisa combinar as duas palavras.', 'Teste divisibilidade por 3 e por 5 separadamente.', 'Use o número em texto apenas quando nenhuma palavra tiver sido acrescentada.'],
  'leap-year': ['Anos terminados em 00 possuem uma exceção.', 'Divisibilidade por 400 tem prioridade.', 'Se não for divisível por 400, precisa ser divisível por 4 e não por 100.'],
  'digit-sum': ['Não é necessário converter a string inteira para um número.', 'Primeiro some os dígitos individualmente.', 'A raiz digital positiva pode ser expressa com o resto por 9; trate zero separadamente.'],
  'interval-overlap': ['A interseção não pode começar antes de nenhum dos intervalos.', 'Use o maior início e o menor fim.', 'Se o início calculado ultrapassar o fim, não existe interseção.'],
  'roman-numeral': ['Compare cada símbolo ao próximo.', 'Um símbolo menor antes de outro maior contribui negativamente.', 'O último símbolo sempre contribui positivamente.'],
  'expression-eval': ['Separe valores de operadores usando duas pilhas.', 'Antes de empilhar um operador, aplique os de maior ou igual precedência.', 'Um parêntese de fechamento resolve operadores até a abertura correspondente.'],
  'binary-search': ['Procure a primeira posição cujo valor é pelo menos target.', 'Mantenha um intervalo semiaberto [low, high).', 'Depois da busca, confirme se a posição encontrada contém target.'],
  'two-sum': ['Ao percorrer j, os candidatos a i já foram vistos.', 'Guarde o primeiro índice de cada valor.', 'Procure target − values[j] antes de registrar o índice atual.'],
  'merge-sorted': ['As duas entradas já estão ordenadas.', 'Use um índice para cada lista e escolha o menor próximo elemento.', 'Ao esgotar uma lista, copie os elementos restantes da outra.'],
  'rotate-array': ['Deslocar n vezes retorna à configuração inicial.', 'Reduza k pelo resto da divisão por n.', 'O trecho final deslocado aparece antes do prefixo original.'],
  gcd: ['O algoritmo de Euclides funciona com restos.', 'mdc(a, b) é igual a mdc(b, a mod b).', 'Normalize os sinais e repita até b ser zero.'],
  'anagram-groups': ['Anagramas têm as mesmas frequências de letras.', 'Uma lista de 26 contadores pode representar uma palavra.', 'Use essa representação como chave e preserve a ordem de inserção dos grupos.'],
  'sliding-window-max': ['Uma deque pode guardar candidatos em ordem decrescente de valor.', 'Remova índices que saíram da janela e candidatos menores que o novo valor.', 'O primeiro índice da deque representa o máximo da janela atual.'],
  'longest-unique-substring': ['Mantenha uma janela sem caracteres repetidos.', 'Registre a posição mais recente de cada caractere.', 'Ao repetir um caractere, avance o início sem nunca retroceder.'],
  'coin-change': ['A melhor resposta para um valor depende de valores menores.', 'dp[0] = 0; os demais começam como inalcançáveis.', 'Para cada moeda possível, compare dp[valor − moeda] + 1.'],
  'interval-merge': ['Ordene cópias dos intervalos pelo início.', 'Compare cada intervalo somente ao último já unido.', 'Quando houver interseção, amplie o fim usando o maior valor.'],
  'topological-sort': ['Conte quantos pré-requisitos cada missão ainda possui.', 'Um min-heap escolhe a menor missão disponível.', 'Se nem todas as missões forem removidas, existe um ciclo.'],
  'shortest-path': ['Pesos não negativos permitem expandir primeiro a menor distância conhecida.', 'Uma fila de prioridade evita ordenar todas as opções a cada passo.', 'Guarde o predecessor ao melhorar uma distância e ignore entradas antigas da fila.'],
  'edit-distance': ['Considere prefixos das duas strings.', 'Compare inserção, remoção e substituição; letras iguais não custam substituição.', 'Apenas a linha anterior da tabela é necessária.'],
  knapsack: ['Para cada capacidade, registre o maior valor já alcançado.', 'Cada item só pode contribuir uma vez.', 'Atualize as capacidades em ordem decrescente para não reutilizar o mesmo item.'],
  'max-subarray': ['A melhor sequência que termina aqui começa aqui ou estende a anterior.', 'Compare o valor atual com a soma anterior acrescida dele.', 'Mantenha também o melhor resultado global e inicialize com o primeiro valor.'],
  'stack-ops': ['Uma pilha segue a ordem último a entrar, primeiro a sair.', 'O fim de um array pode representar o topo.', 'Consultas e remoções em pilha vazia produzem null, sem alterar a estrutura.'],
  'queue-ops': ['A fila remove os elementos na ordem de chegada.', 'Use um índice de início para evitar deslocar todo o array.', 'Uma remoção vazia não deve avançar além do fim da fila.'],
  'balanced-brackets': ['Guarde aberturas ainda não fechadas em uma pilha.', 'Cada fechamento precisa combinar com a última abertura.', 'Ao fim, a pilha deve estar vazia.'],
  'frequency-map': ['Um mapa guarda uma contagem por palavra.', 'Preserve a ordem da primeira inserção de cada chave.', 'Não use um objeto com propriedades herdadas como se todas as chaves fossem seguras.'],
  'linked-list-reverse': ['Guarde o próximo índice antes de alterar o ponteiro atual.', 'Mantenha índices para o nó anterior e o atual.', 'O último nó processado se torna a nova cabeça.'],
  'remove-duplicates': ['Um conjunto permite reconhecer valores já vistos.', 'Percorra a entrada na ordem original.', 'Acrescente à saída apenas a primeira ocorrência.'],
  'bst-search': ['A propriedade de busca elimina uma subárvore por comparação.', 'Se target for menor, vá para a esquerda; se maior, para a direita.', 'Um índice null significa que o valor não existe.'],
  'tree-height': ['Associe uma profundidade a cada nó visitado.', 'Uma pilha explícita evita depender da pilha de chamadas em árvores longas.', 'Registre a maior profundidade alcançada; a raiz começa em um.'],
  'level-order': ['Uma fila visita os nós em largura.', 'No início de cada nível, registre quantos nós já estão na fila.', 'Processe esse lote antes de começar os filhos do próximo nível.'],
  'lru-cache': ['Combine acesso rápido por chave e ordem de uso.', 'Get existente e put precisam mover a chave para a posição mais recente.', 'Remova a chave mais antiga quando ultrapassar a capacidade.'],
  'union-find': ['Represente cada grupo por uma raiz.', 'Compressão de caminhos acelera consultas futuras.', 'Ao unir, conecte a árvore menor à maior.'],
  'trie-prefix': ['Em uma trie, cada aresta representa uma letra.', 'Elimine palavras duplicadas antes de atualizar contagens.', 'Cada nó pode guardar quantas palavras distintas passam por seu prefixo.'],
  'range-sum': ['Uma árvore de Fenwick combina atualizações e somas prefixadas.', 'Uma substituição vira a diferença entre o valor novo e o anterior.', 'Soma de [l, r] = prefixo(r) − prefixo(l − 1).'],
  'median-stream': ['Separe a metade menor e a metade maior.', 'Use max-heap na metade menor e min-heap na maior.', 'Balanceie os tamanhos; a mediana está nos topos.'],
  'heap-top-k': ['Um min-heap de tamanho k guarda os maiores candidatos.', 'Seu topo é o menor dos valores atualmente selecionados.', 'Substitua o topo apenas por um valor maior e ordene o resultado ao final.'],
};

export function getEditorial(challengeId: string, languageId: string) {
  if (challengeId === 'find-max') {
    const solution = maxSolutions[languageId];
    if (!solution) throw new Error('Linguagem sem gabarito para este desafio.');
    return { hints: hints[challengeId], files: [solution], explanation: 'Após cada iteração, best contém o maior valor do trecho já percorrido. São feitas n − 1 comparações para entrada não vazia: tempo O(n), espaço auxiliar O(1), sem alterar a entrada.' };
  }
  if (challengeId === 'shortest-path') return { hints: hints[challengeId], files: [{ path: 'solution.ts', content: shortestPathSource }, { path: 'min-heap.ts', content: heapSource }], explanation: 'Dijkstra expande a menor distância conhecida. Melhorias são inseridas no heap e entradas antigas são ignoradas. Predecessores reconstroem um caminho mínimo. Esta versão usa O(V + E log(E + 1)) de tempo e O(V + E) de memória auxiliar.' };
  if (sqlReferenceQueries[challengeId]) return { hints: ['Observe as colunas e a ordem exigidas no enunciado.', 'Trate valores NULL, duplicatas e empates explicitamente.', 'Use agregação, JOIN, janela ou CTE conforme a relação entre as linhas.'], files: [{ path: 'solution.sql', content: sqlReferenceQueries[challengeId] + '\n' }], explanation: 'A consulta deve funcionar em todas as bases de avaliação, incluindo a base vazia. Tipos, nomes de colunas, duplicatas, NULL e ordem fazem parte do contrato. O plano SQL observado não constitui prova de Big O.' };
  const source = canonicalSources[challengeId];
  if (!source) throw new Error('Desafio sem gabarito.');
  const files = [{ path: 'solution.ts', content: source.replace(/^import\s+\{\s*MinHeap\s*\}\s+from\s+['"]\.\/min-heap['"];?\s*$/m, heapSource) }];
  return { hints: hints[challengeId], files, explanation: `${languageId === 'typescript' ? '' : 'Esta é a referência canônica em TypeScript; a tradução do gabarito para a linguagem selecionada ainda não está disponível. '}A solução aplica a estratégia das dicas ao contrato completo. Compare os casos vazios, limites e regras de desempate antes de adaptar a implementação.` };
}
