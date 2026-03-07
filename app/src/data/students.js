export const SUBJECTS = [
    { key: 'doc_hieu', label: 'Đọc hiểu', short: 'ĐH', max: 4 },
    { key: 'nghi_luan_xh', label: 'NLXH', short: 'XH', max: 2 },
    { key: 'nghi_luan_vh', label: 'NLVH', short: 'VH', max: 4 },
    { key: 'van', label: 'Tổng điểm Văn', short: 'V', max: 10 },
]

export const CLASSES = ['Tất cả', '10A1', '10A2', '11B1', '11B2', '12C1']

function grade(g) {
    if (g >= 9.0) return 'Xuất sắc'
    if (g >= 8.0) return 'Giỏi'
    if (g >= 6.5) return 'Khá'
    if (g >= 5.0) return 'Trung bình'
    return 'Yếu'
}

const firstNames = ['Anh', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hương', 'Khánh', 'Linh', 'Minh', 'Nam', 'Oanh', 'Phúc', 'Quân', 'Sơn', 'Trang', 'Vinh', 'Yến', 'Tú', 'Thảo', 'Huy']
const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng']

const rawStudents = Array.from({ length: 20 }, (_, i) => {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const name = `${lastName} ${firstName}`

    const doc_hieu = Math.round((Math.random() * 2 + 2) * 10) / 10 // 2-4
    const nghi_luan_xh = Math.round((Math.random() * 1 + 1) * 10) / 10 // 1-2
    const nghi_luan_vh = Math.round((Math.random() * 2 + 2) * 10) / 10 // 2-4
    const van = Math.round((doc_hieu + nghi_luan_xh + nghi_luan_vh) * 10) / 10

    return {
        id: i + 1,
        name: name,
        class: ['10A1', '10A2', '11B1', '11B2', '12C1'][Math.floor(Math.random() * 5)],
        color: ['#7c3aed', '#2563eb', '#db2777', '#059669', '#ea580c'][Math.floor(Math.random() * 5)],
        trend: ['up', 'down', 'same'][Math.floor(Math.random() * 3)],
        scores: {
            doc_hieu,
            nghi_luan_xh,
            nghi_luan_vh,
            van
        }
    }
})

export const students = rawStudents.map((s) => ({
    ...s,
    gpa: s.scores.van,
    grade: grade(s.scores.van),
    initials: s.name.split(' ').slice(-2).map(w => w[0]).join(''),
})).sort((a, b) => b.gpa - a.gpa).map((s, i) => ({ ...s, rank: i + 1 }))

export const classStats = CLASSES.filter(c => c !== 'Tất cả').map(cls => {
    const clsStudents = students.filter(s => s.class === cls)
    return {
        class: cls,
        avg: parseFloat((clsStudents.reduce((a, s) => a + s.gpa, 0) / (clsStudents.length || 1)).toFixed(2)),
        count: clsStudents.length,
        top: clsStudents[0],
    }
})
