/**
 * Класс, представляющий функцию принадлежности (функцию соответствия)
 * Поддерживает 4 типа функций: Гауссова, Колоколообразная, S-образная, Z-образная
 */
class MembershipFunction {
    /** @static @property {string[]} types - Список доступных типов функций принадлежности */
    static types = ['gauss', 'bell', 'sigmoid_s', 'sigmoid_z'];
    
    /** @static @property {Object} typeNames - Отображаемые названия типов функций на русском языке */
    static typeNames = {
        gauss: 'Гауссова',
        bell: 'Колоколообразная',
        sigmoid_s: 'S-образная',
        sigmoid_z: 'Z-образная'
    };

    /**
     * @constructor
     * @param {string} type - Тип функции принадлежности
     * @param {Object} params - Параметры функции (mean, sigma для гауссовой; a, b, c для колоколообразной; x0, k для сигмоидных)
     */
    constructor(type, params) {
        this.type = type;
        this.params = { ...params };
    }

    /**
     * Вычисляет значение функции принадлежности в заданной точке
     * @param {number} x - Значение, для которого вычисляется степень принадлежности
     * @returns {number} Значение функции принадлежности в диапазоне [0, 1]
     */
    getValue(x) {
        const { type, params } = this;

        switch (type) {
            case 'gauss':
                return Math.exp(-Math.pow(x - params.mean, 2) / (2 * params.sigma ** 2));
            case 'bell':
                return 1 / (1 + Math.pow(Math.abs((x - params.c) / params.a), 2 * params.b));
            case 'sigmoid_s':
                return 1 / (1 + Math.exp(-params.k * (x - params.x0)));
            case 'sigmoid_z':
                return 1 / (1 + Math.exp(params.k * (x - params.x0)));
            default:
                return 0;
        }
    }

    /**
     * Генерирует параметры по умолчанию для функции принадлежности на основе её типа и позиции терма
     * @static
     * @param {string} type - Тип функции
     * @param {number} idx - Индекс терма (позиция в списке)
     * @param {number} total - Общее количество термов
     * @param {number} [minVal=0] - Минимальное значение диапазона переменной
     * @param {number} [maxVal=1] - Максимальное значение диапазона переменной
     * @returns {Object} Параметры функции по умолчанию
     */
    static getDefaultParams(type, idx, total, minVal = 0, maxVal = 1) {
        const step = (maxVal - minVal) / (total - 1);
        const center = minVal + idx * step;

        switch (type) {
            case 'gauss':
                return { mean: center, sigma: step / 2.2 };
            case 'bell':
                return { a: step / 1.5, b: 2, c: center };
            case 'sigmoid_s':
                return { x0: Math.max(minVal, center - step / 3), k: 15 };
            case 'sigmoid_z':
                return { x0: Math.min(maxVal, center + step / 3), k: 15 };
            default:
                return {};
        }
    }

    /**
     * Возвращает список полей параметров для заданного типа функции (используется для построения UI)
     * @static
     * @param {string} type - Тип функции
     * @returns {Array<Object>} Массив описаний полей параметров
     */
    static getParamFields(type) {
        const base = [
            { name: 'x0', label: 'x₀ (центр):', step: 0.05 },
            { name: 'k', label: 'k (крутизна):', min: 1, max: 50, step: 5 }
        ];

        switch (type) {
            case 'gauss':
                return [
                    { name: 'mean', label: 'μ (центр):', step: 0.05 },
                    { name: 'sigma', label: 'σ (размах):', min: 0.01, max: 0.5, step: 0.02 }
                ];
            case 'bell':
                return [
                    { name: 'a', label: 'a (ширина):', step: 0.05 },
                    { name: 'b', label: 'b (крутизна):', step: 0.5 },
                    { name: 'c', label: 'c (центр):', step: 0.05 }
                ];
            default:
                return type === 'sigmoid_s' || type === 'sigmoid_z' ? base : [];
        }
    }
}

/**
 * Класс, представляющий лингвистическую переменную
 * Содержит набор термов (лингвистических значений) с соответствующими функциями принадлежности
 */
class LinguisticVariable {
    /**
     * @constructor
     * @param {string} name - Название переменной
     * @param {string[]} termNames - Массив названий термов
     * @param {string} [defaultMfType='gauss'] - Тип функции принадлежности по умолчанию
     * @param {boolean} [isQualitative=true] - Является ли переменная качественной (лингвистической)
     * @param {number} [minVal=0] - Минимальное значение числового диапазона
     * @param {number} [maxVal=1] - Максимальное значение числового диапазона
     */
    constructor(name, termNames, defaultMfType = 'gauss', isQualitative = true, minVal = 0, maxVal = 1) {
        this.name = name;
        this.isQualitative = isQualitative;
        this.minVal = minVal;
        this.maxVal = maxVal;
        this.functionsDefined = !isQualitative;
        this.terms = termNames.map((termName, idx) =>
            new Term(
                termName,
                new MembershipFunction(
                    defaultMfType,
                    MembershipFunction.getDefaultParams(defaultMfType, idx, termNames.length, minVal, maxVal)
                )
            )
        );
    }

    /**
     * Обновляет числовой диапазон переменной и пересчитывает параметры всех функций принадлежности
     * @param {number} minVal - Новое минимальное значение
     * @param {number} maxVal - Новое максимальное значение
     */
    updateRange(minVal, maxVal) {
        if (minVal >= maxVal) return;

        [this.minVal, this.maxVal] = [minVal, maxVal];

        this.terms.forEach((term, idx) => {
            term.mf.params = MembershipFunction.getDefaultParams(
                term.mf.type,
                idx,
                this.terms.length,
                minVal,
                maxVal
            );
        });
    }

    /**
     * Вычисляет степень принадлежности значения x к заданному терму
     * @param {number} x - Числовое значение
     * @param {number} idx - Индекс терма
     * @returns {number} Степень принадлежности в диапазоне [0, 1]
     */
    getMembership(x, idx) {
        return this.terms[idx].mf.getValue(x);
    }

    /**
     * Выполняет дефаззификацию одного терма для получения числового значения
     * @param {number} idx - Индекс терма
     * @param {string} [method='centroid'] - Метод дефаззификации ('centroid' - центр тяжести, 'meanmax' - средний максимум)
     * @returns {number} Числовое значение, соответствующее терму
     */
    defuzzifyTerm(idx, method = 'centroid') {
        let numerator = 0, denominator = 0, maxMu = 0, xValues = [];
        const step = (this.maxVal - this.minVal) / 200;

        for (let x = this.minVal; x <= this.maxVal; x += step) {
            const mu = this.getMembership(x, idx);

            if (method === 'centroid') {
                numerator += x * mu;
                denominator += mu;
            } else {
                if (mu > maxMu + 0.001) {
                    maxMu = mu;
                    xValues = [x];
                } else if (Math.abs(mu - maxMu) < 0.001) {
                    xValues.push(x);
                }
            }
        }

        if (method === 'centroid') {
            return denominator > 0 ? numerator / denominator : (this.minVal + this.maxVal) / 2;
        }

        return xValues.length
            ? xValues.reduce((a, b) => a + b, 0) / xValues.length
            : (this.minVal + this.maxVal) / 2;
    }

    /**
     * Выполняет дефаззификацию всех термов переменной
     * @param {string} [method='centroid'] - Метод дефаззификации
     * @returns {number[]} Массив числовых значений для каждого терма
     */
    defuzzifyAllTerms(method = 'centroid') {
        return this.terms.map((_, idx) => this.defuzzifyTerm(idx, method));
    }
}

/**
 * Класс, представляющий терм (лингвистическое значение переменной)
 */
class Term {
    /**
     * @constructor
     * @param {string} name - Название терма
     * @param {MembershipFunction} membershipFunction - Функция принадлежности терма
     */
    constructor(name, membershipFunction) {
        this.name = name;
        this.mf = membershipFunction;
    }
}

// ==================== КОНСТАНТЫ ====================

/** @constant {string[]} DEFAULT_TERMS - Стандартный набор термов для лингвистических переменных */
const DEFAULT_TERMS = ["Малая", "Ниже среднего", "Средняя", "Выше среднего", "Высокая"];

/** @constant {string[]} COLORS - Цветовая палитра для графиков */
const COLORS = ['#e74c3c', '#e67e22', '#f39c12', '#2ecc71', '#3498db'];

/**
 * Возвращает цвет по индексу
 * @function getColor
 * @param {number} i - Индекс
 * @returns {string} Цвет в формате HEX
 */
const getColor = (i) => COLORS[i % COLORS.length];

/** @type {LinguisticVariable} lingVarX - Лингвистическая переменная X */
let lingVarX;

/** @type {LinguisticVariable} lingVarY - Лингвистическая переменная Y */
let lingVarY;

/** @type {Array|null} expertAnswers - Массив ответов экспертов */
let expertAnswers = null;

/** @type {Array|null} currentNumericValues - Текущие числовые значения после дефаззификации */
let currentNumericValues = null;

/** @type {number} currentExpertsCount - Текущее количество экспертов (по умолчанию 10) */
let currentExpertsCount = 10;

// ==================== МОДАЛЬНОЕ ОКНО ====================

/**
 * Показывает модальное окно подтверждения действия
 * @function showConfirmModal
 * @param {string} message - Текст сообщения
 * @param {Function} callback - Функция обратного вызова, получающая boolean (confirmed: true/false)
 */
const showConfirmModal = (message, callback) => {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmYesBtn');
    const noBtn = document.getElementById('confirmNoBtn');
    
    messageEl.textContent = message;
    
    const onYes = () => {
        closeModal();
        if (callback) callback(true);
    };
    
    const onNo = () => {
        closeModal();
        if (callback) callback(false);
    };
    
    const closeModal = () => {
        modal.style.display = 'none';
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        document.removeEventListener('keydown', onKeyDown);
    };
    
    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            if (callback) callback(false);
        } else if (e.key === 'Enter') {
            closeModal();
            if (callback) callback(true);
        }
    };
    
    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
    document.addEventListener('keydown', onKeyDown);
    
    modal.style.display = 'block';
};

/**
 * Закрывает модальное окно подтверждения
 * @function closeModal
 */
const closeModal = () => {
    const modal = document.getElementById('confirmModal');
    modal.style.display = 'none';
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Генерирует случайное значение с нормальным (гауссовым) распределением
 * @function randomNormal
 * @param {number} mean - Среднее значение
 * @param {number} sigma - Стандартное отклонение
 * @param {number} minVal - Минимальное допустимое значение
 * @param {number} maxVal - Максимальное допустимое значение
 * @param {boolean} [isInteger=false] - Возвращать целое число (округлённое)
 * @returns {number} Сгенерированное значение
 */
const randomNormal = (mean, sigma, minVal, maxVal, isInteger = false) => {
    let u = 0, v = 0;

    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    let value = mean + sigma * z;

    if (isInteger) value = Math.round(value);

    return Math.min(maxVal, Math.max(minVal, value));
};

/**
 * Применяет шумовую коррекцию к числовому значению
 * @function applyCorrection
 * @param {number} value - Исходное значение
 * @param {number} noise - Уровень шума (максимальное отклонение)
 * @param {number} minVal - Минимальное допустимое значение
 * @param {number} maxVal - Максимальное допустимое значение
 * @returns {number} Скорректированное значение
 */
const applyCorrection = (value, noise, minVal, maxVal) => {
    return Math.min(maxVal, Math.max(minVal, value + (Math.random() * 2 - 1) * noise));
};

/**
 * Выполняет полиномиальную регрессию методом наименьших квадратов
 * @function polynomialRegression
 * @param {number[]} xValues - Массив значений X
 * @param {number[]} yValues - Массив значений Y
 * @param {number} degree - Степень полинома
 * @returns {number[]} Коэффициенты полинома (от свободного члена до старшей степени)
 */
const polynomialRegression = (xValues, yValues, degree) => {
    const n = xValues.length;
    const X = Array(degree + 1).fill().map(() => Array(degree + 1).fill(0));
    const Y = Array(degree + 1).fill(0);

    for (let i = 0; i <= degree; i++) {
        for (let j = 0; j <= degree; j++) {
            for (let k = 0; k < n; k++) {
                X[i][j] += Math.pow(xValues[k], i + j);
            }
        }
        for (let k = 0; k < n; k++) {
            Y[i] += yValues[k] * Math.pow(xValues[k], i);
        }
    }

    const augmented = X.map((row, i) => [...row, Y[i]]);

    for (let i = 0; i <= degree; i++) {
        let maxRow = i;

        for (let j = i + 1; j <= degree; j++) {
            if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) {
                maxRow = j;
            }
        }

        [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

        for (let j = i + 1; j <= degree; j++) {
            const factor = augmented[j][i] / augmented[i][i];
            for (let k = i; k <= degree + 1; k++) {
                augmented[j][k] -= factor * augmented[i][k];
            }
        }
    }

    const coefficients = new Array(degree + 1);

    for (let i = degree; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j <= degree; j++) {
            sum += augmented[i][j] * coefficients[j];
        }
        coefficients[i] = (augmented[i][degree + 1] - sum) / augmented[i][i];
    }

    return coefficients;
};

/**
 * Возвращает значение по умолчанию для числовой переменной (середина диапазона)
 * @function getDefaultNumericValue
 * @param {LinguisticVariable} lingVar - Лингвистическая переменная
 * @returns {number} Среднее значение диапазона
 */
const getDefaultNumericValue = (lingVar) => {
    return (lingVar.minVal + lingVar.maxVal) / 2;
};

/**
 * Создаёт пустой массив ответов экспертов с заданным количеством
 * @function createEmptyExpertAnswers
 * @param {number} count - Количество экспертов
 * @returns {Array} Массив объектов ответов экспертов
 */
const createEmptyExpertAnswers = (count) => {
    const defaultXTerm = lingVarX.isQualitative ? lingVarX.terms[2].name : null;
    const defaultYTerm = lingVarY.isQualitative ? lingVarY.terms[2].name : null;
    const defaultXVal = getDefaultNumericValue(lingVarX);
    const defaultYVal = getDefaultNumericValue(lingVarY);

    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        xVal: lingVarX.isQualitative ? null : defaultXVal,
        xTerm: lingVarX.isQualitative ? defaultXTerm : null,
        yVal: lingVarY.isQualitative ? null : defaultYVal,
        yTerm: lingVarY.isQualitative ? defaultYTerm : null
    }));
};

/**
 * Обновляет данные экспертов из таблицы в DOM
 * @function updateExpertAnswerFromTable
 */
const updateExpertAnswerFromTable = () => {
    if (!expertAnswers) return;
    
    for (let i = 0; i < expertAnswers.length; i++) {
        const a = expertAnswers[i];

        if (lingVarX.isQualitative) {
            const sel = document.getElementById(`x_term_${i + 1}`);
            if (sel) a.xTerm = sel.value;
        } else {
            const inp = document.getElementById(`x_val_${i + 1}`);
            if (inp) a.xVal = parseFloat(inp.value);
        }

        if (lingVarY.isQualitative) {
            const sel = document.getElementById(`y_term_${i + 1}`);
            if (sel) a.yTerm = sel.value;
        } else {
            const inp = document.getElementById(`y_val_${i + 1}`);
            if (inp) a.yVal = parseFloat(inp.value);
        }
    }
};

// ==================== ОБНОВЛЕНИЕ UI ====================

/**
 * Обновляет статус функций принадлежности для обеих переменных
 * @function updateFunctionsStatus
 */
const updateFunctionsStatus = () => {
    const statusMap = [
        { var: lingVarX, id: 'xFunctionsStatus', showBtnId: 'showFunctionsXBtn' },
        { var: lingVarY, id: 'yFunctionsStatus', showBtnId: 'showFunctionsYBtn' }
    ];

    statusMap.forEach(({ var: v, id, showBtnId }) => {
        const statusDiv = document.getElementById(id);
        const showBtn = document.getElementById(showBtnId);

        if (!v.isQualitative) {
            statusDiv.innerHTML = '<span class="status-badge success">✓ Количественная переменная</span>';
            if (showBtn) showBtn.style.display = 'none';
        } else {
            statusDiv.innerHTML = v.functionsDefined
                ? '<span class="status-badge success">✓ Функции соответствия определены</span>'
                : '<span class="status-badge warning">⚠ Требуется определить функции соответствия</span>';

            if (showBtn) showBtn.style.display = v.functionsDefined ? 'none' : 'inline-block';
        }
    });

    const goToExpertBtn = document.getElementById('goToExpertBtn');

    if (goToExpertBtn) {
        const xReady = lingVarX.isQualitative ? lingVarX.functionsDefined : true;
        const yReady = lingVarY.isQualitative ? lingVarY.functionsDefined : true;
        goToExpertBtn.disabled = !(xReady && yReady);
    }
};

/**
 * Обновляет видимость кнопки "Построить график" в зависимости от состояния данных
 * @function updateBuildChartButtonVisibility
 */
const updateBuildChartButtonVisibility = () => {
    const btn = document.getElementById('buildChartBtn');
    if (!btn) return;
    
    const hasQualitative = lingVarX.isQualitative || lingVarY.isQualitative;
    if (hasQualitative) {
        btn.style.display = currentNumericValues ? 'inline-block' : 'none';
    } else {
        btn.style.display = 'inline-block';
    }
};

// ==================== ГРАФИКИ ====================

/**
 * Строит гистограмму для количественных данных
 * @function buildQuantitativeHistogram
 * @param {string} containerId - ID контейнера для графика
 * @param {number[]} values - Массив числовых значений
 * @param {string} title - Заголовок графика
 * @param {number} minVal - Минимальное значение диапазона
 * @param {number} maxVal - Максимальное значение диапазона
 */
const buildQuantitativeHistogram = (containerId, values, title, minVal, maxVal) => {
    if (!values?.length) return;

    const bins = 10;
    const step = (maxVal - minVal) / bins;
    const histData = new Array(bins).fill(0);

    values.forEach(val => {
        let idx = Math.floor((val - minVal) / step);
        if (idx >= bins) idx = bins - 1;
        if (idx >= 0) histData[idx]++;
    });

    const binLabels = Array.from(
        { length: bins },
        (_, i) => `${(minVal + i * step).toFixed(2)}-${(minVal + (i + 1) * step).toFixed(2)}`
    );

    const container = document.getElementById(containerId);
    if (!container) return;

    Plotly.newPlot(
        containerId,
        [{
            x: binLabels,
            y: histData,
            type: 'bar',
            marker: { color: 'rgba(52,152,219,0.7)' },
            text: histData.map(String),
            textposition: 'bottom'
        }],
        {
            title: title,
            xaxis: { title: 'Диапазоны', tickangle: -45 },
            yaxis: { title: 'Количество' },
            margin: { l: 60, r: 30, t: 50, b: 100 }
        },
        { responsive: true }
    );
};

/**
 * Строит диаграмму рассеяния и аппроксимирующий полином 3-й степени
 * @function buildScatterPlot
 * @param {string} plotId - ID контейнера для графика
 * @param {number[]} xVals - Массив значений X
 * @param {number[]} yVals - Массив значений Y
 */
const buildScatterPlot = (plotId, xVals, yVals) => {
    if (!xVals?.length) return;

    try {
        const coeffs = polynomialRegression(xVals, yVals, 3);
        const xSmooth = [], ySmooth = [];
        const minX = Math.min(...xVals);
        const maxX = Math.max(...xVals);

        if (minX === maxX) {
            xSmooth.push(minX);
            ySmooth.push(coeffs[0]);
        } else {
            for (let x = minX; x <= maxX; x += (maxX - minX) / 100) {
                xSmooth.push(x);
                let y = coeffs[0] + coeffs[1] * x + coeffs[2] * x ** 2 + coeffs[3] * x ** 3;
                ySmooth.push(Math.min(lingVarY.maxVal, Math.max(lingVarY.minVal, y)));
            }
        }

        const polyStr = `Y = ${coeffs[3].toFixed(4)}·X³ ${coeffs[2] >= 0 ? '+' : '-'} ${Math.abs(coeffs[2]).toFixed(4)}·X² ${coeffs[1] >= 0 ? '+' : '-'} ${Math.abs(coeffs[1]).toFixed(4)}·X ${coeffs[0] >= 0 ? '+' : '-'} ${Math.abs(coeffs[0]).toFixed(4)}`;

        Plotly.newPlot(
            plotId,
            [
                {
                    x: xVals,
                    y: yVals,
                    mode: 'markers',
                    type: 'scatter',
                    name: 'Эксперты',
                    marker: { size: 12, color: '#e74c3c', opacity: 0.8 }
                },
                {
                    x: xSmooth,
                    y: ySmooth,
                    mode: 'lines',
                    type: 'scatter',
                    name: 'Аппроксимация (полином 3-й степени)',
                    line: { color: '#2c3e50', width: 3 }
                }
            ],
            {
                title: { text: polyStr, font: { size: 14 } },
                xaxis: { title: lingVarX.name, range: [lingVarX.minVal, lingVarX.maxVal] },
                yaxis: { title: lingVarY.name, range: [lingVarY.minVal, lingVarY.maxVal] },
                hovermode: 'closest',
                legend: { orientation: 'h', y: -0.2 }
            },
            { responsive: true }
        );
    } catch (e) {
        console.error(e);
    }
};

// ==================== СТРАНИЦА НАСТРОЕК ====================

/** @type {string} currentSettingsVar - Текущая выбранная переменная для настроек ('var1' или 'var2') */
let currentSettingsVar = 'var1';

/**
 * Переключает активную панель настроек между X и Y
 * @function switchSettingsVariable
 * @param {string} varId - ID переменной ('var1' или 'var2')
 */
const switchSettingsVariable = (varId) => {
    currentSettingsVar = varId;

    document.querySelectorAll('#varSelectorSettings .var-btn').forEach(btn => {
        btn.classList.toggle('active-var', btn.getAttribute('data-var') === varId);
    });

    document.getElementById('settings-var1-panel').classList.toggle('active-var-panel', varId === 'var1');
    document.getElementById('settings-var2-panel').classList.toggle('active-var-panel', varId === 'var2');
};

/**
 * Отображает настройки функций принадлежности для выбранной переменной
 * @function renderFunctionsSettings
 * @param {string} varId - ID переменной ('var1' или 'var2')
 */
const renderFunctionsSettings = (varId) => {
    const container = document.getElementById(`functions-${varId}-settings`);
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;

    if (!container || !lingVar.isQualitative) return;

    container.innerHTML = lingVar.terms.map((term, idx) => `
        <div class="term-card">
            <h4>${term.name}</h4>
            <div class="param-group">
                <label>Тип функции:</label>
                <select onchange="window.changeMfType('${varId}', ${idx}, this.value)">
                    ${MembershipFunction.types.map(t => `
                        <option value="${t}" ${lingVar.terms[idx].mf.type === t ? 'selected' : ''}>
                            ${MembershipFunction.typeNames[t]}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div id="params-settings-${varId}-${idx}"></div>
            <div id="term-chart-settings-${varId}-${idx}" class="term-chart"></div>
        </div>
    `).join('');

    for (let i = 0; i < lingVar.terms.length; i++) {
        updateParamsSettingsUI(varId, i);
    }

    updateAllChartsSettings(varId);
};

/**
 * Обновляет UI параметров для конкретного терма
 * @function updateParamsSettingsUI
 * @param {string} varId - ID переменной
 * @param {number} idx - Индекс терма
 */
const updateParamsSettingsUI = (varId, idx) => {
    const paramsDiv = document.getElementById(`params-settings-${varId}-${idx}`);
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;

    if (!paramsDiv || !lingVar.isQualitative) return;

    const params = lingVar.terms[idx].mf.params;
    const fields = MembershipFunction.getParamFields(lingVar.terms[idx].mf.type);

    paramsDiv.innerHTML = fields.map(f => `
        <div class="param-group">
            <label>${f.label}</label>
            <input
                type="number"
                value="${params[f.name].toFixed(2)}"
                step="${f.step || 0.05}"
                ${f.min !== undefined ? `min="${f.min}"` : ''}
                ${f.max !== undefined ? `max="${f.max}"` : ''}
                onchange="window.updateMfParam('${varId}', ${idx}, '${f.name}', this.value)">
        </div>
    `).join('');

    updateTermChartSettings(varId, idx);
};

/**
 * Обновляет мини-график функции принадлежности для конкретного терма
 * @function updateTermChartSettings
 * @param {string} varId - ID переменной
 * @param {number} idx - Индекс терма
 */
const updateTermChartSettings = (varId, idx) => {
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;

    if (!lingVar.isQualitative) return;

    const xVals = [], yVals = [];

    for (let x = lingVar.minVal; x <= lingVar.maxVal; x += (lingVar.maxVal - lingVar.minVal) / 200) {
        xVals.push(x);
        yVals.push(lingVar.getMembership(x, idx));
    }

    const chartDiv = document.getElementById(`term-chart-settings-${varId}-${idx}`);

    if (chartDiv) {
        Plotly.newPlot(
            chartDiv,
            [{ x: xVals, y: yVals, mode: 'lines', line: { color: getColor(idx), width: 2 } }],
            {
                title: lingVar.terms[idx].name,
                xaxis: { title: 'x', range: [lingVar.minVal, lingVar.maxVal] },
                yaxis: { title: 'μ(x)', range: [0, 1] },
                height: 180,
                margin: { l: 40, r: 20, t: 30, b: 30 },
                showlegend: false
            }
        );
    }
};

/**
 * Обновляет общий график всех функций принадлежности для переменной
 * @function updateAllChartsSettings
 * @param {string} varId - ID переменной
 */
const updateAllChartsSettings = (varId) => {
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;

    if (!lingVar.isQualitative) return;

    const xVals = [];

    for (let x = lingVar.minVal; x <= lingVar.maxVal; x += (lingVar.maxVal - lingVar.minVal) / 200) {
        xVals.push(x);
    }

    const traces = lingVar.terms.map((term, i) => ({
        x: xVals,
        y: xVals.map(x => lingVar.getMembership(x, i)),
        mode: 'lines',
        line: { color: getColor(i), width: 2 },
        name: term.name
    }));

    Plotly.newPlot(
        `membershipChart-${varId}-settings`,
        traces,
        {
            title: `Функции принадлежности - ${lingVar.name}`,
            xaxis: { title: `Значения (${lingVar.minVal}-${lingVar.maxVal})`, range: [lingVar.minVal, lingVar.maxVal] },
            yaxis: { title: 'μ(x)', range: [0, 1.1] },
            legend: { orientation: 'h', y: -0.2 },
            height: 400
        }
    );

    lingVar.terms.forEach((_, i) => updateTermChartSettings(varId, i));
};

/**
 * Показывает секцию настройки функций принадлежности для переменной
 * @function showMembershipFunctions
 * @param {string} varId - ID переменной
 */
const showMembershipFunctions = (varId) => {
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;

    if (!lingVar.isQualitative) {
        alert("Функции соответствия определяются только для качественных переменных");
        return;
    }

    const sectionDiv = document.getElementById(varId === 'var1' ? 'membershipXSection' : 'membershipYSection');
    sectionDiv.classList.remove('hidden');

    renderFunctionsSettings(varId);
    updateAllChartsSettings(varId);

    lingVar.functionsDefined = true;
    updateFunctionsStatus();
};

/**
 * Изменяет тип переменной (качественная/количественная) с подтверждением
 * @function changeVariableType
 * @param {string} varId - ID переменной
 * @param {string} newType - Новый тип ('qualitative' или 'quantitative')
 * @param {HTMLElement} buttonElement - Кнопка-источник события
 */
const changeVariableType = (varId, newType, buttonElement) => {
    const isQualitative = newType === 'qualitative';
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;
    const currentType = lingVar.isQualitative ? 'qualitative' : 'quantitative';
    
    if (currentType === newType) return;
    
    const typeNames = { qualitative: 'Качественную', quantitative: 'Количественную' };
    
    showConfirmModal(`Вы точно хотите изменить тип переменной на ${typeNames[newType]}?`, (confirmed) => {
        if (confirmed) {
            lingVar.isQualitative = isQualitative;
            lingVar.functionsDefined = !isQualitative;
            
            const container = buttonElement.parentElement;
            const buttons = container.querySelectorAll('.toggle-btn');
            buttons.forEach(btn => {
                if (btn.getAttribute('data-type') === newType) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            const sectionDiv = document.getElementById(varId === 'var1' ? 'membershipXSection' : 'membershipYSection');
            
            updateFunctionsStatus();

            if (!isQualitative) {
                sectionDiv.classList.add('hidden');
            } else if (lingVar.functionsDefined) {
                sectionDiv.classList.remove('hidden');
                renderFunctionsSettings(varId);
                updateAllChartsSettings(varId);
            }
            
            if (document.getElementById('expertPage').classList.contains('active') && expertAnswers) {
                renderExpertTable();
                document.getElementById('statsSection').style.display = 'none';
                document.getElementById('chartSection').style.display = 'none';
                document.getElementById('numericSection').style.display = 'none';
                currentNumericValues = null;
            }
        } else {
            const container = buttonElement.parentElement;
            const buttons = container.querySelectorAll('.toggle-btn');
            buttons.forEach(btn => {
                if (btn.getAttribute('data-type') === currentType) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    });
};

/**
 * Сохраняет текущие настройки переменных (имя, диапазон)
 * @function saveCurrentSettings
 */
const saveCurrentSettings = () => {
    const newNameX = document.getElementById('varXNameInput').value.trim();
    const newNameY = document.getElementById('varYNameInput').value.trim();
    const varXMin = parseFloat(document.getElementById('varXMin').value);
    const varXMax = parseFloat(document.getElementById('varXMax').value);
    const varYMin = parseFloat(document.getElementById('varYMin').value);
    const varYMax = parseFloat(document.getElementById('varYMax').value);

    if (varXMin >= varXMax || varYMin >= varYMax) return;

    lingVarX.name = newNameX;
    lingVarY.name = newNameY;
    lingVarX.updateRange(varXMin, varXMax);
    lingVarY.updateRange(varYMin, varYMax);
};

// ==================== СТРАНИЦА ЭКСПЕРТНОЙ ОЦЕНКИ ====================

/**
 * Применяет новое количество экспертов (с подтверждением)
 * @function applyExpertsCount
 */
const applyExpertsCount = () => {
    const newCount = parseInt(document.getElementById('expertsCountInput').value);
    if (isNaN(newCount) || newCount < 1) {
        alert("Введите корректное количество экспертов (от 1 до 50)");
        document.getElementById('expertsCountInput').value = currentExpertsCount;
        return;
    }
    if (newCount > 50) {
        alert("Максимальное количество экспертов - 50");
        document.getElementById('expertsCountInput').value = currentExpertsCount;
        return;
    }
    
    showConfirmModal('Вы точно хотите изменить число экспертов? Таблица будет пересоздана', (confirmed) => {
        if (confirmed) {
            currentExpertsCount = newCount;
            expertAnswers = createEmptyExpertAnswers(currentExpertsCount);
            currentNumericValues = null;
            
            renderGenerationHeader();
            renderExpertTable();
            
            document.getElementById('statsSection').style.display = 'none';
            document.getElementById('chartSection').style.display = 'none';
            document.getElementById('numericSection').style.display = 'none';
        } else {
            document.getElementById('expertsCountInput').value = currentExpertsCount;
        }
    });
};

/**
 * Отображает панель генерации данных над таблицей экспертов
 * @function renderGenerationHeader
 */
const renderGenerationHeader = () => {
    const container = document.getElementById('generationHeader');

    const genHtml = (lingVar, prefix) => {
        if (lingVar.isQualitative) {
            const firstTerm = lingVar.terms[0].name;
            const lastTerm = lingVar.terms[lingVar.terms.length - 1].name;

            return `
                <div class="param-desc">Генерация по рангам (1-${firstTerm}, 5-${lastTerm})</div>
                <div style="display:flex; justify-content: center; gap: 10px;">
                    <div>
                        <label>Средний ранг</label>
                        <input type="number" id="gen${prefix}Mean" value="${Math.floor(lingVar.terms.length / 2) + 1}" step="0.2" min="1" max="${lingVar.terms.length}" style="width:100px">
                    </div>
                    <div>
                        <label>Ст. отклонение</label>
                        <input type="number" id="gen${prefix}Sigma" value="0.5" step="0.1" min="0.3" max="3" style="width:100px">
                    </div>
                </div>
                <button id="generate${prefix}Btn" class="btn-success" style="margin-top: 8px;">Сгенерировать ${prefix}</button>
            `;
        } else {
            return `
                <div class="param-desc">Генерация по значениям</div>
                <div style="display:flex; justify-content: center; gap: 10px;">
                    <div>
                        <label>Среднее значение</label>
                        <input type="number" id="gen${prefix}Mean" value="${getDefaultNumericValue(lingVar)}" step="0.1" min="${lingVar.minVal}" max="${lingVar.maxVal}" style="width:100px">
                    </div>
                    <div>
                        <label>Ст. отклонение</label>
                        <input type="number" id="gen${prefix}Sigma" value="${(lingVar.maxVal - lingVar.minVal) / 16}" step="0.05" min="0.05" max="${(lingVar.maxVal - lingVar.minVal) / 2}" style="width:100px">
                    </div>
                </div>
                <button id="generate${prefix}Btn" class="btn-success" style="margin-top: 8px;">Сгенерировать ${prefix}</button>
            `;
        }
    };

    container.innerHTML = `
        <div class="column-header-item">
            <label>Автоматическое заполнение столбца переменной X</label>
            ${genHtml(lingVarX, 'X')}
        </div>
        <div class="column-header-item">
            <label>Автоматическое заполнение столбца переменной Y</label>
            ${genHtml(lingVarY, 'Y')}
        </div>
    `;

    document.getElementById('generateXBtn')?.addEventListener('click', () => generateColumn('X'));
    document.getElementById('generateYBtn')?.addEventListener('click', () => generateColumn('Y'));
};

/**
 * Генерирует случайные значения для указанного столбца (X или Y) с нормальным распределением
 * @function generateColumn
 * @param {string} column - 'X' или 'Y'
 */
const generateColumn = (column) => {
    showConfirmModal('Применить генерацию? Текущие значения будут заменены', (confirmed) => {
        if (confirmed) {
            if (!expertAnswers) {
                expertAnswers = createEmptyExpertAnswers(currentExpertsCount);
            }

            const isX = column === 'X';
            const lingVar = isX ? lingVarX : lingVarY;
            const mean = parseFloat(document.getElementById(`gen${column}Mean`).value);
            const sigma = parseFloat(document.getElementById(`gen${column}Sigma`).value);

            expertAnswers.forEach(a => {
                if (lingVar.isQualitative) {
                    const rank = randomNormal(mean, sigma, 1, lingVar.terms.length, true);

                    if (isX) {
                        a.xTerm = lingVar.terms[rank - 1].name;
                        a.xVal = null;
                    } else {
                        a.yTerm = lingVar.terms[rank - 1].name;
                        a.yVal = null;
                    }
                } else {
                    const val = randomNormal(mean, sigma, lingVar.minVal, lingVar.maxVal);

                    if (isX) {
                        a.xVal = val;
                        a.xTerm = null;
                    } else {
                        a.yVal = val;
                        a.yTerm = null;
                    }
                }
            });

            renderExpertTable();

            document.getElementById('statsSection').style.display = 'none';
            document.getElementById('chartSection').style.display = 'none';
            document.getElementById('numericSection').style.display = 'none';
            currentNumericValues = null;
            
            updateBuildChartButtonVisibility();
        }
    });
};

/**
 * Отрисовывает таблицу ответов экспертов
 * @function renderExpertTable
 */
const renderExpertTable = () => {
    if (!expertAnswers) return;

    const rows = expertAnswers.map((a, i) => `
        <tr>
            <td style="text-align:center; font-weight:bold;">${i + 1}</td>
            <td style="text-align:center">
                ${lingVarX.isQualitative
                    ? `<select id="x_term_${i + 1}">
                        ${lingVarX.terms.map(t => `
                            <option value="${t.name}" ${t.name === (a.xTerm || lingVarX.terms[2].name) ? 'selected' : ''}>
                                ${t.name}
                            </option>
                        `).join('')}
                       </select>`
                    : `<input type="number" id="x_val_${i + 1}" value="${(a.xVal ?? getDefaultNumericValue(lingVarX)).toFixed(4)}" step="0.01" min="${lingVarX.minVal}" max="${lingVarX.maxVal}">`
                }
            </td>
            <td style="text-align:center">
                ${lingVarY.isQualitative
                    ? `<select id="y_term_${i + 1}">
                        ${lingVarY.terms.map(t => `
                            <option value="${t.name}" ${t.name === (a.yTerm || lingVarY.terms[2].name) ? 'selected' : ''}>
                                ${t.name}
                            </option>
                        `).join('')}
                       </select>`
                    : `<input type="number" id="y_val_${i + 1}" value="${(a.yVal ?? getDefaultNumericValue(lingVarY)).toFixed(4)}" step="0.01" min="${lingVarY.minVal}" max="${lingVarY.maxVal}">`
                }
            </td>
        </tr>
    `).join('');

    document.getElementById('expertTableContainer').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>№</th>
                    <th>X: ${lingVarX.name}</th>
                    <th>Y: ${lingVarY.name}</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
};

/**
 * Очищает таблицу ответов экспертов (с подтверждением)
 * @function clearExpertTable
 */
const clearExpertTable = () => {
    showConfirmModal('Вы точно хотите очистить таблицу?', (confirmed) => {
        if (confirmed) {
            if (!expertAnswers) return;

            const defaultXTerm = lingVarX.isQualitative ? lingVarX.terms[2].name : null;
            const defaultYTerm = lingVarY.isQualitative ? lingVarY.terms[2].name : null;
            const defaultXVal = getDefaultNumericValue(lingVarX);
            const defaultYVal = getDefaultNumericValue(lingVarY);

            expertAnswers.forEach((a, i) => {
                if (lingVarX.isQualitative) {
                    a.xTerm = defaultXTerm;
                    a.xVal = null;
                } else {
                    a.xVal = defaultXVal;
                    a.xTerm = null;
                }

                if (lingVarY.isQualitative) {
                    a.yTerm = defaultYTerm;
                    a.yVal = null;
                } else {
                    a.yVal = defaultYVal;
                    a.yTerm = null;
                }
            });

            renderExpertTable();

            document.getElementById('statsSection').style.display = 'none';
            document.getElementById('chartSection').style.display = 'none';
            document.getElementById('numericSection').style.display = 'none';
            currentNumericValues = null;
            
            updateBuildChartButtonVisibility();
        }
    });
};

/**
 * Показывает статистику распределения ответов экспертов
 * @function showStatistics
 */
const showStatistics = () => {
    if (!expertAnswers) {
        alert("Сначала введите ответы экспертов");
        return;
    }

    const N = expertAnswers.length;
    updateExpertAnswerFromTable();

    const getDistribution = (lingVar, getTerm) => {
        if (lingVar.isQualitative) {
            const dist = new Array(lingVar.terms.length).fill(0);
            expertAnswers.forEach(a => {
                const idx = lingVar.terms.findIndex(t => t.name === getTerm(a));
                if (idx !== -1) dist[idx]++;
            });
            return dist;
        } else {
            return expertAnswers.map(a => getTerm(a));
        }
    };

    const distX = getDistribution(lingVarX, a => a.xTerm ?? a.xVal);
    const distY = getDistribution(lingVarY, a => a.yTerm ?? a.yVal);

    const statsContainer = document.getElementById('statsContainer');

    const buildStatHtml = (lingVar, dist, N) => {
        if (lingVar.isQualitative) {
            return `
                <div class="stat-card">
                    <h4>${lingVar.name}</h4>
                    <table>
                        ${lingVar.terms.map((t, i) => `
                            <tr>
                                <td style="text-align:left">${t.name}</td>
                                <td style="text-align:center"><b>${dist[i]}</b></td>
                                <td style="text-align:center">${((dist[i] / N) * 100).toFixed(1)}%</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
        } else {
            const mean = dist.reduce((a, b) => a + b, 0) / N;
            return `
                <div class="stat-card">
                    <h4>${lingVar.name}</h4>
                    <table>
                        <tr><td style="text-align:left">Среднее</td><td style="text-align:center">${mean.toFixed(4)}</td></tr>
                        <tr><td style="text-align:left">Минимум</td><td style="text-align:center">${Math.min(...dist).toFixed(4)}</td></tr>
                        <tr><td style="text-align:left">Максимум</td><td style="text-align:center">${Math.max(...dist).toFixed(4)}</td></tr>
                    </table>
                </div>
            `;
        }
    };

    statsContainer.innerHTML = buildStatHtml(lingVarX, distX, N);
    statsContainer.innerHTML += buildStatHtml(lingVarY, distY, N);

    document.getElementById('statsSection').style.display = 'block';

    setTimeout(() => {
        if (lingVarX.isQualitative) {
            Plotly.newPlot(
                'distrChartVar1',
                [{ x: lingVarX.terms.map(t => t.name), y: distX, type: 'bar', marker: { color: 'rgba(52,152,219,0.7)' } }],
                { title: `Распределение X (N=${N})`, xaxis: { title: 'Термы' }, yaxis: { title: 'Количество' }, height: 280, margin: { l: 50, r: 20, t: 40, b: 60 } }
            );
        } else {
            buildQuantitativeHistogram('distrChartVar1', distX, `Распределение X (N=${N})`, lingVarX.minVal, lingVarX.maxVal);
        }

        if (lingVarY.isQualitative) {
            Plotly.newPlot(
                'distrChartVar2',
                [{ x: lingVarY.terms.map(t => t.name), y: distY, type: 'bar', marker: { color: 'rgba(46,204,113,0.7)' } }],
                { title: `Распределение Y (N=${N})`, xaxis: { title: 'Термы' }, yaxis: { title: 'Количество' }, height: 280, margin: { l: 50, r: 20, t: 40, b: 60 } }
            );
        } else {
            buildQuantitativeHistogram('distrChartVar2', distY, `Распределение Y (N=${N})`, lingVarY.minVal, lingVarY.maxVal);
        }
    }, 50);
};

/**
 * Выполняет дефаззификацию ответов экспертов для получения числовых значений
 * @function applyDefuzzification
 */
const applyDefuzzification = () => {
    if (!expertAnswers) {
        alert("Сначала введите ответы экспертов");
        return;
    }

    updateExpertAnswerFromTable();

    const method = document.getElementById('defuzzMethod').value;
    const termValuesX = lingVarX.defuzzifyAllTerms(method);
    const termValuesY = lingVarY.defuzzifyAllTerms(method);
    const termToValueX = Object.fromEntries(lingVarX.terms.map((t, i) => [t.name, termValuesX[i]]));
    const termToValueY = Object.fromEntries(lingVarY.terms.map((t, i) => [t.name, termValuesY[i]]));

    currentNumericValues = expertAnswers.map(a => ({
        id: a.id,
        crispX: lingVarX.isQualitative ? termToValueX[a.xTerm] : a.xVal,
        crispY: lingVarY.isQualitative ? termToValueY[a.yTerm] : a.yVal
    }));

    const numericHtml = currentNumericValues.map(n => `
        <tr>
            <td style="text-align:center; font-weight:bold;">${n.id}</td>
            <td style="text-align:center">
                <input type="number" id="num_x_${n.id}" value="${n.crispX.toFixed(4)}" step="0.01" min="${lingVarX.minVal}" max="${lingVarX.maxVal}">
            </td>
            <td style="text-align:center">
                <input type="number" id="num_y_${n.id}" value="${n.crispY.toFixed(4)}" step="0.01" min="${lingVarY.minVal}" max="${lingVarY.maxVal}">
            </td>
        </tr>
    `).join('');

    document.getElementById('numericTableContainer').innerHTML = `
        <table>
            <thead>
                <tr><th>№</th><th>X: ${lingVarX.name}</th><th>Y: ${lingVarY.name}</th></tr>
            </thead>
            <tbody>${numericHtml}</tbody>
        </table>
    `;

    const renderCorrectionHeader = () => {
        const container = document.getElementById('correctionHeader');

        container.innerHTML = `
            <div class="column-header-item">
                <label>${lingVarX.isQualitative ? 'Коррекция дефаззифицированных значений X' : 'Количественная X'}</label>
                ${lingVarX.isQualitative
                    ? `<div class="param-desc">Отклонить полученные значения в пределах указанной величины</div>
                       <input type="number" id="correctionXNoise" value="0.2" step="0.02" min="0" max="0.5" style="width:100px;">
                       <button id="applyCorrectionXBtn" class="btn-warning" style="margin-top:8px;">Применить коррекцию</button>`
                    : '<div class="param-desc">Количественная - прямое редактирование без коррекции </div>'
                }
            </div>
            <div class="column-header-item">
                <label>${lingVarY.isQualitative ? 'Коррекция дефаззифицированных значений Y' : 'Количественная Y'}</label>
                ${lingVarY.isQualitative
                    ? `<div class="param-desc">Отклонить полученные значения в пределах указанной величины</div>
                       <input type="number" id="correctionYNoise" value="0.2" step="0.02" min="0" max="0.5" style="width:100px;">
                       <button id="applyCorrectionYBtn" class="btn-warning" style="margin-top:8px;">Применить коррекцию</button>`
                    : '<div class="param-desc">Количественная - прямое редактирование без коррекции </div>'
                }
            </div>
        `;

        document.getElementById('applyCorrectionXBtn')?.addEventListener('click', () => applyCorrectionToColumn('X'));
        document.getElementById('applyCorrectionYBtn')?.addEventListener('click', () => applyCorrectionToColumn('Y'));
    };

    renderCorrectionHeader();

    document.getElementById('numericSection').style.display = 'block';
    document.getElementById('chartSection').style.display = 'none';
    
    updateBuildChartButtonVisibility();
};

/**
 * Применяет шумовую коррекцию к значениям указанного столбца (с подтверждением)
 * @function applyCorrectionToColumn
 * @param {string} column - 'X' или 'Y'
 */
const applyCorrectionToColumn = (column) => {
    showConfirmModal('Применить коррекцию? Текущие значения будут заменены', (confirmed) => {
        if (confirmed) {
            if (!currentNumericValues) {
                alert("Сначала примените дефаззификацию");
                return;
            }

            const isX = column === 'X';
            const lingVar = isX ? lingVarX : lingVarY;
            const noise = parseFloat(document.getElementById(`correction${column}Noise`).value);
            const method = document.getElementById('defuzzMethod').value;
            const termToValue = Object.fromEntries(lingVar.terms.map((t, i) => [t.name, lingVar.defuzzifyTerm(i, method)]));

            for (let i = 1; i <= currentNumericValues.length; i++) {
                const sel = document.getElementById(`${isX ? 'x_term' : 'y_term'}_${i}`);

                if (sel) {
                    let crisp = termToValue[sel.value];
                    crisp = applyCorrection(crisp, noise, lingVar.minVal, lingVar.maxVal);

                    const inp = document.getElementById(`num_${isX ? 'x' : 'y'}_${i}`);

                    if (inp) {
                        inp.value = crisp.toFixed(4);
                        if (isX) currentNumericValues[i - 1].crispX = crisp;
                        else currentNumericValues[i - 1].crispY = crisp;
                    }
                }
            }
        }
    });
};

/**
 * Строит график зависимости Y от X после дефаззификации
 * @function buildChart
 */
const buildChart = () => {
    if (!lingVarX.isQualitative && !lingVarY.isQualitative) {
        if (!expertAnswers) {
            alert("Нет данных для построения графика");
            return;
        }
        
        updateExpertAnswerFromTable();
        
        const xVals = [];
        const yVals = [];
        
        for (let i = 0; i < expertAnswers.length; i++) {
            const a = expertAnswers[i];
            if (a.xVal !== null && a.yVal !== null) {
                xVals.push(a.xVal);
                yVals.push(a.yVal);
            }
        }
        
        if (xVals.length === 0) {
            alert("Нет данных для построения графика");
            return;
        }
        
        buildScatterPlot('scatterPlot', xVals, yVals);
        document.getElementById('chartSection').style.display = 'block';
        return;
    }
    
    if (!currentNumericValues) {
        alert("Сначала получите численные значения (примените дефаззификацию)");
        return;
    }

    const xVals = [], yVals = [];

    for (let i = 1; i <= currentNumericValues.length; i++) {
        const inpX = document.getElementById(`num_x_${i}`);
        const inpY = document.getElementById(`num_y_${i}`);

        if (inpX && inpY) {
            xVals.push(parseFloat(inpX.value));
            yVals.push(parseFloat(inpY.value));
        } else {
            const n = currentNumericValues[i - 1];
            if (n?.crispX !== null && n?.crispY !== null) {
                xVals.push(n.crispX);
                yVals.push(n.crispY);
            }
        }
    }

    if (!xVals.length) {
        alert("Нет данных для построения графика");
        return;
    }

    buildScatterPlot('scatterPlot', xVals, yVals);
    document.getElementById('chartSection').style.display = 'block';
};

// ==================== НАВИГАЦИЯ ====================

/**
 * Переход на страницу экспертной оценки
 * @function goToExpertPage
 */
const goToExpertPage = () => {
    saveCurrentSettings();

    document.getElementById('settingsPage').classList.remove('active');
    document.getElementById('expertPage').classList.add('active');
    document.getElementById('backToSettingsBtn').style.display = 'block';
    document.getElementById('goToExpertBtn').style.display = 'none';

    const expertsCountInput = document.getElementById('expertsCountInput');
    if (expertsCountInput && parseInt(expertsCountInput.value) !== currentExpertsCount) {
        expertsCountInput.value = currentExpertsCount;
    }

    expertAnswers = createEmptyExpertAnswers(currentExpertsCount);
    
    currentNumericValues = null;

    renderGenerationHeader();
    renderExpertTable();

    const hasQualitative = lingVarX.isQualitative || lingVarY.isQualitative;
    document.getElementById('defuzzPanel').style.display = hasQualitative ? 'block' : 'none';
    document.getElementById('numericSection').style.display = 'none';
    document.getElementById('statsSection').style.display = 'none';
    document.getElementById('chartSection').style.display = 'none';
    
    updateBuildChartButtonVisibility();
};

/**
 * Возврат на страницу настроек переменных (с подтверждением)
 * @function backToSettingsPage
 */
const backToSettingsPage = () => {
    showConfirmModal('Вы точно хотите вернуться к настройкам переменных? История работы с ответами будет очищена', (confirmed) => {
        if (confirmed) {
            document.getElementById('expertPage').classList.remove('active');
            document.getElementById('settingsPage').classList.add('active');
            document.getElementById('backToSettingsBtn').style.display = 'none';
            document.getElementById('goToExpertBtn').style.display = 'block';
            
            expertAnswers = null;
            currentNumericValues = null;
        }
    });
};

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Глобальная функция для изменения типа функции принадлежности терма (вызывается из DOM)
 * @function window.changeMfType
 * @param {string} varId - ID переменной
 * @param {number} idx - Индекс терма
 * @param {string} newType - Новый тип функции
 */
window.changeMfType = (varId, idx, newType) => {
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;
    const newParams = MembershipFunction.getDefaultParams(newType, idx, lingVar.terms.length, lingVar.minVal, lingVar.maxVal);

    lingVar.terms[idx].mf = new MembershipFunction(newType, newParams);
    updateParamsSettingsUI(varId, idx);
    updateAllChartsSettings(varId);
};

/**
 * Глобальная функция для обновления параметра функции принадлежности (вызывается из DOM)
 * @function window.updateMfParam
 * @param {string} varId - ID переменной
 * @param {number} idx - Индекс терма
 * @param {string} paramName - Название параметра
 * @param {number} value - Новое значение параметра
 */
window.updateMfParam = (varId, idx, paramName, value) => {
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;

    lingVar.terms[idx].mf.params[paramName] = parseFloat(value);
    updateTermChartSettings(varId, idx);
    updateAllChartsSettings(varId);
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

/**
 * Инициализирует приложение: создаёт переменные, навешивает обработчики событий
 * @function init
 */
const init = () => {
    lingVarX = new LinguisticVariable("Возможность интенсивного использования ПО", [...DEFAULT_TERMS], 'gauss', true, 0, 1);
    lingVarY = new LinguisticVariable("Удобство использования", [...DEFAULT_TERMS], 'gauss', true, 0, 1);
    lingVarX.functionsDefined = false;
    lingVarY.functionsDefined = false;

    document.getElementById('varSelectorSettings').innerHTML = `
        <button class="var-btn active-var" data-var="var1">Настройки переменной X</button>
        <button class="var-btn" data-var="var2">Настройки переменной Y</button>
    `;

    document.querySelectorAll('#varSelectorSettings .var-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSettingsVariable(btn.getAttribute('data-var')));
    });

    updateFunctionsStatus();

    document.getElementById('showFunctionsXBtn').addEventListener('click', () => showMembershipFunctions('var1'));
    document.getElementById('showFunctionsYBtn').addEventListener('click', () => showMembershipFunctions('var2'));

    const xToggleBtns = document.querySelectorAll('#varXTypeToggle .toggle-btn');
    xToggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newType = btn.getAttribute('data-type');
            changeVariableType('var1', newType, btn);
        });
    });

    const yToggleBtns = document.querySelectorAll('#varYTypeToggle .toggle-btn');
    yToggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newType = btn.getAttribute('data-type');
            changeVariableType('var2', newType, btn);
        });
    });

    const updateXRange = () => {
        lingVarX.updateRange(
            parseFloat(document.getElementById('varXMin').value),
            parseFloat(document.getElementById('varXMax').value)
        );

        if (lingVarX.isQualitative && !document.getElementById('membershipXSection').classList.contains('hidden')) {
            renderFunctionsSettings('var1');
            updateAllChartsSettings('var1');
        }
    };

    const updateYRange = () => {
        lingVarY.updateRange(
            parseFloat(document.getElementById('varYMin').value),
            parseFloat(document.getElementById('varYMax').value)
        );

        if (lingVarY.isQualitative && !document.getElementById('membershipYSection').classList.contains('hidden')) {
            renderFunctionsSettings('var2');
            updateAllChartsSettings('var2');
        }
    };

    document.getElementById('varXMin').addEventListener('change', updateXRange);
    document.getElementById('varXMax').addEventListener('change', updateXRange);
    document.getElementById('varYMin').addEventListener('change', updateYRange);
    document.getElementById('varYMax').addEventListener('change', updateYRange);

    document.getElementById('goToExpertBtn').addEventListener('click', goToExpertPage);
    document.getElementById('backToSettingsBtn').addEventListener('click', backToSettingsPage);
    document.getElementById('clearTableBtn').addEventListener('click', clearExpertTable);
    document.getElementById('showStatsBtn').addEventListener('click', showStatistics);
    document.getElementById('applyDefuzzBtn').addEventListener('click', applyDefuzzification);
    document.getElementById('buildChartBtn').addEventListener('click', buildChart);
    document.getElementById('applyExpertsCountBtn').addEventListener('click', applyExpertsCount);
    
    const modal = document.getElementById('confirmModal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}