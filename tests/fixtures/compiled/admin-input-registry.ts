// Match the package registry: input wrappers load their template as a child view.
const modules = import.meta.glob('./.generated/js/*-input-*.ts', {eager: true}) as Record<string, {default: any}>;

export function adminInputs(theme: string): Record<string, any> {
    return Object.fromEntries(Object.entries(modules).flatMap(([file, module]) => {
        const name = file.split('/').at(-1)!;
        const prefix = theme + '-input-';
        return name.startsWith(prefix)
            ? [[`admin.themes.${theme}.components.inputs.${name.slice(prefix.length, -3)}`, module.default]]
            : [];
    }));
}
