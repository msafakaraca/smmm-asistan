/**
 * Helper function to render template with variables
 * Used client-side but can be used server-side for validation
 */
export function renderTemplate(
    template: string,
    variables: Record<string, string>
): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
        result = result.replace(regex, value);
    });

    return result;
}
