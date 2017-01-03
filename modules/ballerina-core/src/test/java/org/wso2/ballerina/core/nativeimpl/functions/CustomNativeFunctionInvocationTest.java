/*
*   Copyright (c) 2016, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
*
*  WSO2 Inc. licenses this file to you under the Apache License,
*  Version 2.0 (the "License"); you may not use this file except
*  in compliance with the License.
*  You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/
package org.wso2.ballerina.core.nativeimpl.functions;

import org.testng.Assert;
import org.testng.annotations.Test;
import org.wso2.ballerina.core.interpreter.BLangInterpreter;
import org.wso2.ballerina.core.interpreter.Context;
import org.wso2.ballerina.core.interpreter.SymScope;
import org.wso2.ballerina.core.model.BallerinaFile;
import org.wso2.ballerina.core.model.expressions.FunctionInvocationExpr;
import org.wso2.ballerina.core.model.values.BString;
import org.wso2.ballerina.core.model.values.BValueType;
import org.wso2.ballerina.core.utils.FunctionUtils;
import org.wso2.ballerina.core.utils.ParserUtils;

/**
 * Test Custom Native function Invocation.
 */
public class CustomNativeFunctionInvocationTest {

    @Test
    public void testCustomNativeFunctionInvocation() {
        final String funcName = "invokeNativeFunction";

        // Add Native functions.
        SymScope symScope = new SymScope();
        FunctionUtils.addNativeFunction(symScope, new EchoStringNativeFunction());

        BallerinaFile bFile = ParserUtils.parseBalFile("samples/nativeimpl/customNative.bal", symScope);

        final String s1 = "Hello World...!!!";
        BValueType[] arguments = {new BString(s1)};
        FunctionInvocationExpr funcIExpr = FunctionUtils.createInvocationExpr(bFile, funcName, arguments.length);

        Context bContext = FunctionUtils.createInvocationContext(arguments, 1);
        BLangInterpreter bLangInterpreter = new BLangInterpreter(bContext);
        funcIExpr.accept(bLangInterpreter);

        Assert.assertEquals(FunctionUtils.getReturnValue(bContext).stringValue(), s1);
    }
}