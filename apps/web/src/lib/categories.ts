export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
}

export interface FlatCategoryOption {
  id: string;
  label: string;
}

export function flattenCategories(tree: CategoryNode[], depth = 0): FlatCategoryOption[] {
  return tree.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.name}` },
    ...flattenCategories(node.children, depth + 1),
  ]);
}
