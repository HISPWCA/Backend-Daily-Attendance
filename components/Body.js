import React, { useEffect, useState } from 'react'

import Select from 'react-select'
import moment from 'moment'

import { EuiInMemoryTable } from '@elastic/eui'
import { BsCheckCircle } from 'react-icons/bs'
import { VscDebugConsole } from 'react-icons/vsc'
import { AiOutlineCloseCircle } from 'react-icons/ai'
import { DatePicker, Tooltip } from 'antd'

import { LOG_ROUTES } from '../utils/api.route'
import { ALL, GUC_SIM, NEW, OLD, PERSONNAL_SIM, WRONG } from '../utils/constants'

const Body = ({ basePath }) => {

    const [isLoading, setIsLoading] = useState(false)
    const [loadingQuery, setLoadingQuery] = useState(false)

    const [items, setItems] = useState([])
    const [selectedStartDate, setSelectedStartDate] = useState(moment().startOf('month'))
    const [selectedEndDate, setSelectedEndDate] = useState(moment())
    const [selectedTypeLogsToDisplay, setSelectedTypeLogsToDisplay] = useState({ value: ALL, label: 'All Logs' })
    const [successLogs, setSuccessLogs] = useState([])
    const [errorLogs, setErrorLogs] = useState([])
    const [totalSuccessLogs, setTotalSuccessLogs] = useState(0)
    const [totalErrorLogs, setTotalErrorLogs] = useState(0)
    const [totalLogs, setTotalLogs] = useState(0)

    let debounceTimeoutId
    let requestTimeoutId

    const handleGetLog = async () => {
        try {
            setLoadingQuery(true)
            if (selectedStartDate && selectedEndDate) {
                const route = basePath?.concat(LOG_ROUTES)
                    .concat('?startDate=')
                    .concat(moment(selectedStartDate).format('YYYY-MM-DD'))
                    .concat('&')
                    .concat('endDate=')
                    .concat(moment(selectedEndDate).format('YYYY-MM-DD'))

                const request = await fetch(route)
                const response = await request.json()
                if (response.status === 'ERROR')
                    throw response

                setTotalErrorLogs(response.data.totalErrorLogs)
                setTotalSuccessLogs(response.data.totalSuccessLogs)
                setTotalLogs(response.data.totalLogs)
                setSuccessLogs(response.data.successLogs)
                setErrorLogs(response.data.errorLogs)
                if (selectedTypeLogsToDisplay.value === ALL)
                    setItems([...response.data.successLogs, ...response.data.errorLogs])

                if (selectedTypeLogsToDisplay.value === 'SUCCESS')
                    setItems(response.data.successLogs)

                if (selectedTypeLogsToDisplay.value === 'ERROR')
                    setItems(response.data.errorLogs)

                setLoadingQuery(false)

            } else {
                throw new Error('Start date and end date are required')
            }
        } catch (err) {
            console.log(err)
            setLoadingQuery(false)
        }
    }


    const onQueryChange = ({ query }) => {
        clearTimeout(debounceTimeoutId)
        clearTimeout(requestTimeoutId)

        debounceTimeoutId = setTimeout(() => {
            setIsLoading(true)

            requestTimeoutId = setTimeout(() => {
                let items = []
                let results = selectedTypeLogsToDisplay.value === ALL ?
                    [...successLogs, ...errorLogs] :
                    selectedTypeLogsToDisplay.value === 'ERROR' ?
                        errorLogs :
                        selectedTypeLogsToDisplay.value === 'SUCCESS' ?
                            successLogs : []

                items = results.filter(log => {
                    const storeDict = `${log.organisationUnit?.displayName} ${log.format?.title} ${log.text} ${log.description} ${log.status} ${log.phone} ${log.message} ${moment(log.date, 'DD-MM-YYYY HH:mm:ss').format('DD MMM YYYY HH:mm:ss').toString()} ${log.version?.title}`.toLowerCase()
                    const normalizedQuery = query.text.toLowerCase()

                    return storeDict.indexOf(normalizedQuery) !== -1
                })

                setIsLoading(false)
                setItems(items)
            }, 1000)
        }, 300)
    }

    const RenderToolsRight = () => (
        <>
            <div>
                <Select
                    styles={{
                        control: base => ({ ...base, minWidth: '300px' })
                    }}
                    placeholder='Select Log type'
                    options={
                        [
                            {
                                value: ALL,
                                label: 'All logs'
                            },
                            {
                                value: 'SUCCESS',
                                label: 'Success Logs'
                            },
                            {
                                value: 'ERROR',
                                label: 'Error Logs'
                            }
                        ]
                    }
                    value={selectedTypeLogsToDisplay}
                    onChange={option => {
                        setSelectedTypeLogsToDisplay(option)

                        if (option.value === ALL)
                            setItems([...successLogs, ...errorLogs])

                        if (option.value === 'SUCCESS')
                            setItems(successLogs)

                        if (option.value === 'ERROR')
                            setItems(errorLogs)
                    }}
                />
            </div>
        </>
    )

    const search = {
        onChange: onQueryChange,
        toolsRight: RenderToolsRight(),
        box: {
            incremental: true,
        },
    }

    const getImportStyle = importCount => {
        let color = '#fff'

        if (importCount.ignored === 0 && importCount.deleted === 0)
            return '#2EC4B6'

        if (importCount.ignored > 0 && importCount.deleted === 0)
            return '#f4a261'

        if (importCount.deleted > 0)
            return '#EA2B1F'

        return color
    }

    const data = items.map(item => ({
        ...item,
        organisationUnitName: item.organisationUnit?.displayName,
        phoneNumber: item.phone,
        errorMessage: item.message,
        importCount: item.importCount
    }))

    const columns = [
        {
            field: 'phoneNumber',
            name: 'Phone number',
            sortable: true,
            render: phone => <div className='font-bold text-gray-700'> {phone} </div>
        },
        {
            field: 'text',
            name: 'SMS Text',

            render: text => <div className='text-gray-500 line-clamp-2 text-sm'>
                <Tooltip
                    color='#fff'
                    title={<div className=' text-gray-500'>{text}</div>} >
                    <span className='cursor-pointer'>  {text}</span>
                </Tooltip>
            </div>,

            sortable: true
        },
        {
            field: 'format',
            name: 'Format',
            render: name => <div>
                {name.id === NEW && <div className=' text bg-[#2EC4B660] text-sm px-2 py-1 rounded-2xl '>{name.title}</div>}
                {name.id === OLD && <div className=' text bg-[#f4a261] text-sm px-2 py-1 rounded-2xl '>{name.title}</div>}
                {name.id === WRONG && <div className=' text bg-red-300 text-sm px-2 py-1 rounded-2xl '>{name.title}</div>}
            </div>,
            sortable: true
        },
        {
            field: 'organisationUnitName',
            name: 'School',
            render: name => <div className='font-bold text-gray-700 text-sm'>{name}</div>,
            sortable: true
        },
        {
            field: 'version',
            name: 'SIM Card Type',
            render: version => <div className='text-sm'>
                {version.id === PERSONNAL_SIM && <div className='bg-blue-100 text-gray-700 px-3 py-1 rounded-xl '> {version.title} </div>}
                {version.id === GUC_SIM && <div className='bg-[#2EC4B660] text-gray-700 px-3 py-1 rounded-xl '> {version.title} </div>}
            </div>,
            sortable: true,
        },
    ]


    if (selectedTypeLogsToDisplay.value === 'ERROR')
        columns.push({
            field: 'errorMessage',
            name: 'Error messages',
            sortable: true,
            render: msg => (
                <div>
                    {msg && <div className='text-gray-600  border-red-900 px-3 py-1 text-sm rounded-xl bg-red-200 line-clamp-2 hover:line-clamp-none'> {msg}</div>}
                </div>
            )
        })

    if (selectedTypeLogsToDisplay.value !== 'ERROR')
        columns.push(
            {
                field: 'importCount',
                name: 'Import Summary',
                render: importCount => <div>
                    {importCount && (
                        <>
                            <div className='text-gray-500 line-clamp-2 text-sm'>
                                <Tooltip
                                    color={getImportStyle(importCount)}
                                    title={
                                        <div className='p-3 text-gray-900'>
                                            <div><span>Imported: </span> <span className='ml-2  text-sm  font-bold'>{importCount.imported}</span></div>
                                            <div><span>Updated:  </span> <span className='ml-2 font-bold'>{importCount.updated}</span></div>
                                            <div><span>Ignored:  </span> <span className='ml-2 font-bold'>{importCount.ignored}</span></div>
                                            <div><span>Deleted:  </span> <span className='ml-2 font-bold'>{importCount.deleted}</span></div>
                                        </div>
                                    } >
                                    <div className='cursor-pointer'>
                                        <div className='line-clamp-2 text-gray-800 px-2 py-1 rounded-xl' style={{ background: getImportStyle(importCount) + '60' }}>
                                            <div><span className='text-sm'>Imported: </span> <span className='ml-2  text-xs  font-bold'>{importCount.imported}</span></div>
                                            <div><span className='text-sm'>Updated:  </span> <span className='ml-2   text-xs font-bold'>{importCount.updated}</span></div>
                                            <div><span className='text-sm'>Ignored:  </span> <span className='ml-2   text-xs font-bold'>{importCount.ignored}</span></div>
                                            <div><span className='text-sm'>Deleted:  </span> <span className='ml-2   text-xs font-bold'>{importCount.deleted}</span></div>
                                        </div>
                                    </div>
                                </Tooltip>
                            </div>
                        </>
                    )}
                </div>
            }
        )

    columns.push({
        field: 'date',
        sortable: true,
        name: 'Sent Date',

        render: date => (
            <div className='text-gray-500 text-sm'>
                {date && moment(date, 'DD-MM-YYYY HH:mm:ss').format('DD MMM YYYY HH:mm:ss')}
            </div>
        ),
    })

    const Table = () => (
        <div className='mt-10'>
            <div className='font-bold text-lg underline my-3'> List</div>
            <div className='p-4 shadow-lg rounded-lg bg-white border'>
                <EuiInMemoryTable
                    tableCaption='Demo of EuiInMemoryTable with search callback'
                    items={data}
                    loading={isLoading || loadingQuery ? true : false}
                    columns={columns}
                    search={search}
                    pagination={true}
                    sorting={{ sort: { field: 'date', direction: 'desc' } }}
                />
            </div>
        </div>
    )

    const RenderSuccessBox = () => (
        <div className='px-3 py-1 bg-[#c6f8ff20] rounded-2xl border shadow-md border-l-8 border-[#2ec4b6]'>
            <div className='py-2 px-5 mx-auto w-full flex items-center justify-between'>
                <div>
                    <div className='text-gray-600 text-[15px] underline' > Total Success </div>
                    <div className='text-5xl text-black font-bold mt-1'>{totalSuccessLogs}</div>
                    <div className='mt-3 text-[14px] text-gray-600'>
                        <span>from</span><span className='font-bold  ml-1'> {moment(selectedStartDate).format('DD MMM YYYY')} </span>
                        <span className=' ml-1'>to </span> <span className='font-bold ml-1'>{moment(selectedEndDate).format('DD MMM YYYY')}</span>
                    </div>
                </div>
                <div className='text-6xl text-[#2ec4b6] font-bold '><BsCheckCircle /></div>
            </div>
        </div>
    )

    const RenderErrorBox = () => (
        <div className='px-3 py-1 bg-[#ffb3c120] rounded-2xl border shadow-md border-l-8 border-[#ef233c80]'>
            <div className='py-2 px-5 mx-auto w-full flex items-center justify-between'>
                <div>
                    <div className='text-gray-600 font-bold text-[15px] underline' > Total Error </div>
                    <div className='text-5xl text-black font-bold mt-1'>{totalErrorLogs}</div>
                    <div className='mt-3 text-[14px] text-gray-600'>
                        <span>from</span><span className='font-bold  ml-1'> {moment(selectedStartDate).format('DD MMM YYYY')} </span>
                        <span className='ml-1'>to </span> <span className='font-bold ml-1'>{moment(selectedEndDate).format('DD MMM YYYY')}</span>
                    </div>
                </div>
                <div className='text-6xl text-[#ef233c] font-bold '>
                    <AiOutlineCloseCircle />
                </div>
            </div>
        </div>
    )

    const RenderTotalBox = () => (
        <div className='px-3 py-1 bg-[#edf2fb] rounded-2xl border shadow-md border-l-8 border-[#4cc9f0]'>
            <div className='py-2 px-5 mx-auto w-full flex items-center justify-between'>
                <div>
                    <div className='text-gray-600 font-bold text-[15px] underline' > Total</div>
                    <div className='text-5xl text-black font-bold mt-1'>{totalLogs}</div>
                    <div className='mt-3 text-[14px] text-gray-600'>
                        <span>from</span><span className='font-bold  ml-1'> {moment(selectedStartDate).format('DD MMM YYYY')} </span>
                        <span className=' ml-1'>to </span> <span className='font-bold ml-1'>{moment(selectedEndDate).format('DD MMM YYYY')}</span>
                    </div>
                </div>
                <div className='text-6xl text-[#4cc9f0] font-bold '><VscDebugConsole /></div>
            </div>
        </div>
    )

    const RenderSingleBox = () => (
        <div className='mx-auto col-span-3 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 sm:gap-y-10 md:grid-cols-3 xl:gap-x-8 mt-5'>
            {RenderSuccessBox()}
            {RenderErrorBox()}
            {RenderTotalBox()}
        </div>
    )


    const RenderFilters = () => (
        <div className='my-5'>
            <div className='flex items-center justify-center'>
                <div>Select Interval Date : </div>
                <div className='ml-4'>
                    <DatePicker.RangePicker
                        value={[moment(selectedStartDate), moment(selectedEndDate)]}
                        disabledDate={date => moment().isAfter(date) ? false : true}
                        onChange={range => {
                            if (range && range.length > 1) {
                                setSelectedStartDate(range[0])
                                setSelectedEndDate(range[1])
                            }
                        }}
                    />
                </div>
                <div className='ml-4'>
                    <button
                        className='px-4 py-2 bg-[#2ec4b690] rounded-lg hover:bg-[#2ec4b6] hover:scale-105 duration-200 font-bold flex items-center'
                        onClick={handleGetLog}
                    >
                        {loadingQuery && (
                            <div role='status'>
                                <svg className='inline mr-2 w-4 h-4 text-white animate-spin dark:text-gray-600 fill-black' viewBox='0 0 100 101' fill='none' xmlns='http://www.w3.org/2000/svg'>
                                    <path d='M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z' fill='currentColor' />
                                    <path d='M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z' fill='currentFill' />
                                </svg>
                                <span className='sr-only'>Loading...</span>
                            </div>
                        )}
                        <span>
                            Update
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )

    useEffect(() => {
        handleGetLog()
    }, [])

    return (
        <>
            <div className='max-w-[1500px] mx-auto p-4'>
                <div className='text-2xl mt-10 font-bold text-center underline'> DHIS2 SMS Logs App</div>
                <div className='mt-10'>
                    {RenderFilters()}
                    {RenderSingleBox()}
                    {Table()}
                </div>
            </div>
        </>
    )
}


export default Body