/*
 * Copyright (c) 2017, WSO2 Inc. (http://wso2.com) All Rights Reserved.
 * <p>
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package org.ballerinalang.natives;

import org.ballerinalang.bre.Context;
import org.ballerinalang.model.AnnotationAttachment;
import org.ballerinalang.model.ConstDef;
import org.ballerinalang.model.Identifier;
import org.ballerinalang.model.NativeUnit;
import org.ballerinalang.model.NodeLocation;
import org.ballerinalang.model.NodeVisitor;
import org.ballerinalang.model.ParameterDef;
import org.ballerinalang.model.SymbolName;
import org.ballerinalang.model.SymbolScope;
import org.ballerinalang.model.TypeMapper;
import org.ballerinalang.model.VariableDef;
import org.ballerinalang.model.WhiteSpaceDescriptor;
import org.ballerinalang.model.Worker;
import org.ballerinalang.model.statements.BlockStmt;
import org.ballerinalang.model.statements.Statement;
import org.ballerinalang.model.symbols.BLangSymbol;
import org.ballerinalang.model.types.BType;
import org.ballerinalang.model.types.SimpleTypeName;
import org.ballerinalang.model.values.BValue;
import org.ballerinalang.natives.exceptions.ArgumentOutOfRangeException;
import org.ballerinalang.util.exceptions.BallerinaException;
import org.ballerinalang.util.exceptions.FlowBuilderException;

import java.util.ArrayList;
import java.util.List;
import java.util.Queue;

/**
 * {@code {@link AbstractNativeTypeMapper }} represents a Abstract implementation of Native Ballerina TypeMapper.
 */
public abstract class AbstractNativeTypeMapper implements NativeUnit, TypeMapper, BLangSymbol {
    /* Void RETURN */
    public static final BValue[] VOID_RETURN = new BValue[0];

    // BLangSymbol related attributes
    protected Identifier identifier;
    protected String pkgPath;
    protected boolean isPublic = true;
    protected SymbolName symbolName;

    private List<AnnotationAttachment> annotations;
    private List<ParameterDef> parameterDefs;
    private List<ParameterDef> returnParams;
    private List<ConstDef> constants;
    private int stackFrameSize;
    
    private BType[] returnParamTypes;
    private BType[] parameterTypes;
    private SimpleTypeName[] returnParamTypeNames;
    private SimpleTypeName[] argTypeNames;
    private String[] argNames;
    private int tempStackFrameSize;

    public AbstractNativeTypeMapper() {
        parameterDefs = new ArrayList<>();
        returnParams = new ArrayList<>();
        annotations = new ArrayList<>();
        constants = new ArrayList<>();
    }

    @Override
    public String getTypeMapperName() {
        return symbolName.getName();
    }

    @Override
    public void setSymbolName(SymbolName symbolName) {
        this.symbolName = symbolName;
    }

    @Override
    public AnnotationAttachment[] getAnnotations() {
        return annotations.toArray(new AnnotationAttachment[annotations.size()]);
    }

    public ParameterDef[] getParameterDefs() {
        return parameterDefs.toArray(new ParameterDef[parameterDefs.size()]);
    }

    /**
     * Get all the variableDcls declared in the scope of BallerinaTypeMapper.
     *
     * @return list of all BallerinaTypeMapper scoped variableDcls
     */
    public VariableDef[] getVariableDefs() {
        return new VariableDef[0];
    }

    public ParameterDef[] getReturnParameters() {
        return returnParams.toArray(new ParameterDef[returnParams.size()]);
    }

    /**
     * Get Argument by index.
     *
     * @param context current {@code {@link Context }} instance.
     * @param index   index of the parameter.
     * @return BValue;
     */
    public BValue getArgument(Context context, int index) {
        if (index > -1 && index < parameterTypes.length) {
            BValue result = context.getControlStack().getCurrentFrame().values[index];
            if (result == null) {
                throw new BallerinaException("argument " + index + " is null");
            }
            return result;
        }
        throw new ArgumentOutOfRangeException(index);
    }

    /**
     * Where Native TypeMapper logic is implemented.
     *
     * @param context Current Context instance
     * @return Native typeMapper return BValue arrays
     */
    public abstract BValue convert(Context context);

    public void convertNative(Context context) {
        BValue retVals = convert(context);
        BValue[] returnRefs = context.getControlStack().getCurrentFrame().returnValues;
        if (returnRefs.length != 0) {
            returnRefs[0] = retVals;
        }
    }

    /**
     * Util method to construct BValue arrays.
     *
     * @param values BValues to construct the array
     * @return Array of BValues
     */
    public BValue[] getBValues(BValue... values) {
        return values;
    }


    public ConstDef[] getTypeMapperConstats() {
        return constants.toArray(new ConstDef[constants.size()]);
    }
    
    @Override
    public int getStackFrameSize() {
        return stackFrameSize;
    }

    @Override
    public void setStackFrameSize(int stackFrameSize) {
        this.stackFrameSize = stackFrameSize;
    }

    @Override
    public int getTempStackFrameSize() {
        return tempStackFrameSize;
    }

    @Override
    public void setTempStackFrameSize(int stackFrameSize) {
        if (this.tempStackFrameSize > 0 && stackFrameSize != this.tempStackFrameSize) {
            throw new FlowBuilderException("Attempt to Overwrite tempValue Frame size. current :" +
                    this.tempStackFrameSize + ", new :" + stackFrameSize);
        }
        this.tempStackFrameSize = stackFrameSize;
    }

    @Override
    public BlockStmt getCallableUnitBody() {
        return null;
    }

    @Override
    public BType[] getReturnParamTypes() {
        return returnParamTypes;
    }

    @Override
    public void setReturnParamTypes(BType[] returnParamTypes) {
        this.returnParamTypes = returnParamTypes;
    }

    @Override
    public BType[] getArgumentTypes() {
        return parameterTypes;
    }

    @Override
    public void setParameterTypes(BType[] parameterTypes) {
        this.parameterTypes = parameterTypes;
    }

    // Methods in Node interface

    @Override
    public void accept(NodeVisitor visitor) {
    }

    public NodeLocation getNodeLocation() {
        return null;
    }

    @Override
    public WhiteSpaceDescriptor getWhiteSpaceDescriptor() {
        return null;
    }

    // Methods in BLangSymbol interface

    @Override
    public String getName() {
        return identifier.getName();
    }

    @Override
    public Identifier getIdentifier() {
        return identifier;
    }

    @Override
    public String getPackagePath() {
        return pkgPath;
    }

    @Override
    public boolean isPublic() {
        return isPublic;
    }

    @Override
    public boolean isNative() {
        return true;
    }

    @Override
    public SymbolName getSymbolName() {
        return symbolName;
    }

    @Override
    public SymbolScope getSymbolScope() {
        return null;
    }
    
    // Methods in NativeCallableUnit interface
    
    @Override
    public void setReturnParamTypeNames(SimpleTypeName[] returnParamTypes) {
        this.returnParamTypeNames = returnParamTypes;
    }
    
    @Override
    public void setArgTypeNames(SimpleTypeName[] argTypes) {
        this.argTypeNames = argTypes;
    }
    
    @Override
    public void setArgNames(String[] argNames) {
        this.argNames = argNames;
    }

    @Override
    public SimpleTypeName[] getArgumentTypeNames() {
        return argTypeNames;
    }

    @Override
    public String[] getArgumentNames() {
        return argNames;
    }

    @Override
    public SimpleTypeName[] getReturnParamTypeNames() {
        return returnParamTypeNames;
    }
    
    @Override
    public void setName(String name) {
        this.identifier = new Identifier(name);
    }
    
    @Override
    public void setPackagePath(String packagePath) {
        this.pkgPath = packagePath;
    }

    /**
     * Get worker interaction statements related to a callable unit
     *
     * @return Queue of worker interactions
     */
    @Override
    public Queue<Statement> getWorkerInteractionStatements() {
        return null;
    }

    /**
     * Get the workers defined within a callable unit
     *
     * @return Array of workers
     */
    @Override
    public Worker[] getWorkers() {
        return new Worker[0];
    }
}
