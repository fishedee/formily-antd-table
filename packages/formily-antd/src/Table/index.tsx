import { ArrayField, Field } from '@formily/core';
import {
    RecursionField,
    Schema,
    useField,
    useFieldSchema,
    useForm,
} from '@formily/react';
import { observer } from '@formily/reactive-react';
import React, { Fragment } from 'react';
import { Table } from 'antd';
import { ReactElement } from 'react';
import { isColumnType, isCheckedColumnType, isRadioColumnType } from './IsType';
import { ColumnsType, ColumnType } from 'antd/lib/table';
import { ArrayIndexContextProvider } from './Context';
import { ColumnGroupType } from 'antd/lib/table';
import Column, { ColumnProps } from './Column';
import CheckedColumn, { CheckedColumnProps } from './CheckedColumn';
import { RowSelectionType, TableRowSelection } from 'antd/lib/table/interface';
import RadioColumn, { RadioColumnProps } from './RadioColumn';

type TextProps = {
    value: string;
};

type Column = {
    title: string;
    dataIndex: string;
    key: string;
    schema: Schema;
    width?: number;
    ellipsis?: boolean;
    fixed?: 'left' | 'right';
    children?: Column[];
};

function getColumn(schema: Schema): Column[] {
    //在当前实现中，Column层看成是Field
    let itemsSchema: Schema['items'] = schema.items;
    const items = Array.isArray(itemsSchema) ? itemsSchema : [itemsSchema];
    //获取当前array的field
    let form = useForm();
    let field = useField();
    const parseSource = (schema: Schema): Column[] => {
        //在渲染的时候，手动拿出每个Column的Field，并且将Schema作为保底逻辑
        //这里的写法，其实是先取field数据，再去createField
        //当第一次render的时候，Field不存在时，返回值为undefined
        let columnField = form.query(field.address + '.' + schema.name).take();
        let component = schema['x-component'];
        let isVisible = columnField ? columnField.visible : schema['x-visible'];
        if (isVisible == false) {
            return [];
        }
        if (isColumnType(component)) {
            //获取该列的信息
            const style: ColumnProps = {};
            style.width = columnField
                ? columnField.componentProps?.width
                : schema['x-component-props']?.width;
            style.ellipsis = columnField
                ? columnField.componentProps?.ellipsis
                : schema['x-component-props']?.ellipsis;
            style.fixed = columnField
                ? columnField.componentProps?.fixed
                : schema['x-component-props']?.fixed;
            return [
                {
                    key: schema.name + '',
                    dataIndex: schema.name + '',
                    title: columnField ? columnField.title : schema.title,
                    schema: schema,
                    children: reduceProperties(schema),
                    ...style,
                },
            ];
        }
        return [];
    };
    const reduceProperties = (schema: Schema): Column[] => {
        //对于items里面的每个schema，每个Schema为Void字段，遍历它的Properties
        if (schema.properties) {
            return schema.reduceProperties((current, schema) => {
                return current.concat(parseSource(schema));
            }, [] as Column[]);
        } else {
            return [];
        }
    };
    return items.reduce((current, schema) => {
        //遍历每个items里面的schema
        if (schema) {
            return current.concat(reduceProperties(schema));
        }
        return current;
    }, [] as Column[]);
}

type RowSelectedColumn = {
    type: RowSelectionType;
    dataIndex: string;
    key: string;
    schema: Schema;
};

function getRowSelectedColumn(schema: Schema): RowSelectedColumn[] {
    let itemsSchema: Schema['items'] = schema.items;
    const items = Array.isArray(itemsSchema) ? itemsSchema : [itemsSchema];
    let form = useForm();
    let field = useField();
    const parseSource = (schema: Schema): RowSelectedColumn[] => {
        let columnField = form.query(field.address + '.' + schema.name).take();
        let component = schema['x-component'];
        let isVisible = columnField ? columnField.visible : schema['x-visible'];
        if (isVisible == false) {
            return [];
        }
        if (isCheckedColumnType(component)) {
            //获取该列的信息
            const style = {
                dataIndex: columnField
                    ? columnField.componentProps?.dataIndex
                    : schema['x-component-props']?.dataIndex,
            };
            return [
                {
                    key: schema.name + '',
                    type: 'checkbox',
                    schema: schema,
                    ...style,
                },
            ];
        } else if (isRadioColumnType(component)) {
            //获取该列的信息
            const style = {
                dataIndex: columnField
                    ? columnField.componentProps?.dataIndex
                    : schema['x-component-props']?.dataIndex,
            };
            return [
                {
                    key: schema.name + '',
                    type: 'radio',
                    schema: schema,
                    ...style,
                },
            ];
        }
        return [];
    };
    const reduceProperties = (schema: Schema): RowSelectedColumn[] => {
        //对于items里面的每个schema，每个Schema为Void字段，遍历它的Properties
        if (schema.properties) {
            return schema.reduceProperties((current, schema) => {
                return current.concat(parseSource(schema));
            }, [] as RowSelectedColumn[]);
        } else {
            return [];
        }
    };
    return items.reduce((current, schema) => {
        //遍历每个items里面的schema
        if (schema) {
            return current.concat(reduceProperties(schema));
        }
        return current;
    }, [] as RowSelectedColumn[]);
}

function getDataSource(data: any[], columns: Column[]): any[] {
    let result = [];
    for (var i in data) {
        var single = {
            _index: i,
        };
        result.push(single);
    }
    return result;
}

function getDataColumns(
    columns: Column[]
): (ColumnGroupType<unknown> | ColumnType<unknown>)[] {
    const convertColumn = (column: Column) => {
        if (column.children && column.children.length != 0) {
            let single: ColumnGroupType<unknown> = {
                ...column,
                children: column.children.map(convertColumn),
            };
            return single;
        } else {
            let single: ColumnType<unknown> = {
                ...column,
                render: (value: any, record: any, index: number) => {
                    return (
                        <ArrayIndexContextProvider value={record._index}>
                            <RecursionField
                                name={record._index}
                                schema={column.schema}
                                onlyRenderProperties
                            />
                        </ArrayIndexContextProvider>
                    );
                },
            };
            return single;
        }
    };
    return columns.map(convertColumn);
}

function getRowSelection(
    data: any[],
    columns: RowSelectedColumn[]
): TableRowSelection<any> | undefined {
    let column: RowSelectedColumn | undefined;
    if (columns && columns.length != 0) {
        column = columns[0];
    }
    if (!column) {
        return undefined;
    }
    let selectedRowKeys = [];
    for (var i = 0; i != data.length; i++) {
        let single = data[i];
        if (single[column.dataIndex]) {
            selectedRowKeys.push(i + '');
        }
    }
    const rowSelection = {
        type: column.type,
        selectedRowKeys: selectedRowKeys,
        onChange: (selectedRowKeys: React.Key[], selectedRows: any[]) => {
            let selectedKey: { [key in number]: boolean } = {};
            for (let i in selectedRowKeys) {
                let index = selectedRowKeys[i] as number;
                selectedKey[index] = true;
            }
            for (let i = 0; i != data.length; i++) {
                let single = data[i];
                if (selectedKey[i]) {
                    single[column!.dataIndex] = true;
                } else {
                    single[column!.dataIndex] = false;
                }
            }
        },
        selections: [
            Table.SELECTION_ALL,
            Table.SELECTION_INVERT,
            Table.SELECTION_NONE,
        ],
    };
    return rowSelection;
}
type PropsType = Field & {
    children: (index: number) => ReactElement;
};

type MyTableType = React.FC<PropsType> & {
    Column?: React.FC<ColumnProps>;
    CheckboxColumn?: React.FC<CheckedColumnProps>;
    RadioColumn?: React.FC<RadioColumnProps>;
};

const MyTable: MyTableType = observer((props: PropsType) => {
    const field = useField<ArrayField>();
    const fieldSchema = useFieldSchema();
    const tableColumns = getColumn(fieldSchema);

    const dataSource = getDataSource(field.value, tableColumns);
    const dataColumns: ColumnsType<any> = getDataColumns(tableColumns);

    const rowSelectedColumns = getRowSelectedColumn(fieldSchema);
    const rowSelection: TableRowSelection<any> | undefined = getRowSelection(
        field.value,
        rowSelectedColumns
    );
    return (
        <Fragment>
            <Table
                rowKey="_index"
                bordered={true}
                columns={dataColumns}
                dataSource={dataSource}
                rowSelection={rowSelection}
            />
            {tableColumns.map((column) => {
                //这里实际渲染每个Column，以保证Column能接收到Reaction
                //注意要使用onlyRenderSelf
                return (
                    <RecursionField
                        key={column.key}
                        name={column.key}
                        schema={column.schema}
                        onlyRenderSelf
                    />
                );
            })}
            {rowSelectedColumns.map((column) => {
                //这里实际渲染每个RowSelectedColumn，以保证Column能接收到Reaction
                //注意要使用onlyRenderSelf
                return (
                    <RecursionField
                        key={column.key}
                        name={column.key}
                        schema={column.schema}
                        onlyRenderSelf
                    />
                );
            })}
        </Fragment>
    );
});

MyTable.Column = Column;

MyTable.CheckboxColumn = CheckedColumn;

MyTable.RadioColumn = RadioColumn;

export default MyTable;
