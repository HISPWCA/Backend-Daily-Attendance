
export const oldFormatMapping = (text) => {
    if (!text || text.trim() === "")
        return false

    if (text.split(' ')?.length === 3) {
        if (
            text.includes('TP.') ||
            text.includes('AP.') ||
            text.includes('AW.') ||
            text.includes('LA.') ||
            text.includes('LB.') ||
            text.includes('SP.') ||
            text.includes('SA.')
        ) {
            return true
        } else {
            return false
        }
    } else {
        return true
    }
}
